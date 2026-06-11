import os
import re
import sqlite3
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
from werkzeug.utils import secure_filename
import pytesseract
from PIL import Image

app = Flask(__name__)
CORS(app)

# THIS IS CRUCIAL: Point Python to your Tesseract installation!
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- NEW: DATABASE SETUP ---
def init_db():
    conn = sqlite3.connect('tax_ledger.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS receipts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT,
            date TEXT,
            description TEXT,
            comment TEXT,
            total REAL,
            net REAL,
            tax_rate INTEGER,
            tax_amount REAL
        )
    ''')
    conn.commit()
    conn.close()

init_db() # Runs when the app starts

def get_db_connection():
    conn = sqlite3.connect('tax_ledger.db')
    conn.row_factory = sqlite3.Row
    return conn

# --- OCR SCANNER ENDPOINT ---
@app.route('/api/upload', methods=['POST'])
def upload_receipt():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if file:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            text = pytesseract.image_to_string(Image.open(filepath))
            text_lower = text.lower()

            date_match = re.search(r'\d{2}[/-]\d{2}[/-]\d{4}', text)
            extracted_date = "2026-01-01" 
            if date_match:
                raw_date = date_match.group()
                parts = raw_date.replace('/', '-').split('-')
                if len(parts[2]) == 4: 
                    extracted_date = f"{parts[2]}-{parts[1]}-{parts[0]}"

            amounts = re.findall(r'\d+[.,]\d{2}', text)
            total_amount = 0.0
            if amounts:
                float_amounts = [float(a.replace(',', '.')) for a in amounts]
                total_amount = max(float_amounts)

            keywords_7_percent = ['water', 'eau']
            rate_type = 19
            if any(keyword in text_lower for keyword in keywords_7_percent):
                rate_type = 7

            os.remove(filepath)

            return jsonify({
                "date": extracted_date,
                "total": total_amount,
                "rate_type": rate_type,
                "description": "Auto-Scanned Receipt",
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500

# --- CALCULATE & SAVE ENDPOINT ---
@app.route('/api/calculate', methods=['POST'])
def calculate_tax():
    data = request.get_json()
    try:
        total = float(data.get('total'))
        rate_type = int(data.get('rate_type')) 
        description = data.get('description', 'General')
        date = data.get('date', '2026-01-01')
        transaction_type = data.get('type', 'buy')
        comment = data.get('comment', '') 
        
        if rate_type == 19:
            net = total / 1.19
        elif rate_type == 7:
            net = total / 1.07
        else:
            return jsonify({"error": "Invalid tax rate."}), 400
            
        tax_amount = total - net

        # --- NEW: Save directly to SQLite Database ---
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO receipts (type, date, description, comment, total, net, tax_rate, tax_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (transaction_type, date, description, comment, round(total, 2), round(net, 2), rate_type, round(tax_amount, 2)))
        conn.commit()
        
        # Grab the newly created ID to send back to React
        new_id = cursor.lastrowid
        conn.close()

        receipt = {
            "id": new_id,
            "type": transaction_type, 
            "date": date,
            "description": description,
            "comment": comment,
            "total": round(total, 2),
            "net": round(net, 2),
            "tax_rate": rate_type,
            "tax_amount": round(tax_amount, 2)
        }
        
        return jsonify(receipt), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- FETCH RECEIPTS ENDPOINT ---
@app.route('/api/receipts', methods=['GET'])
def get_receipts():
    conn = get_db_connection()
    receipts = conn.execute('SELECT * FROM receipts').fetchall()
    conn.close()
    
    # Convert database rows back to a list of dictionaries for React
    return jsonify([dict(ix) for ix in receipts])

# --- EXCEL EXPORT ENDPOINT ---
@app.route('/api/export', methods=['GET'])
def export_to_excel():
    conn = get_db_connection()
    df = pd.read_sql_query("SELECT * FROM receipts", conn)
    conn.close()

    if df.empty:
        return jsonify({"error": "No data to export"}), 400
    
    df.columns = ['ID', 'Type', 'Date', 'Description', 'Shop / Comment', 'Gross (€)', 'Net (€)', 'Tax Rate (%)', 'Tax Amount (€)']
    df.to_excel('Tax_Report.xlsx', index=False)
    
    return jsonify({"message": "Exported successfully to Tax_Report.xlsx"})

if __name__ == '__main__':
    app.run(port=5000, debug=True)