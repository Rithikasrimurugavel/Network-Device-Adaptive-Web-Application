import json
import uuid
import re
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response
from config import Config
import db

app = Flask(__name__)
app.config.from_object(Config)

# Initialize Database Schema & Initial Data
with app.app_context():
    db.init_db()

@app.after_request
def add_client_hints_headers(response):
    response.headers['Accept-CH'] = 'Save-Data, ECT, Sec-CH-UA-Memory, Downlink, RTT'
    response.headers['Vary'] = 'Accept-CH, Save-Data, ECT, Sec-CH-UA-Memory'
    return response

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/order-confirmation/<int:order_id>')
def order_confirmation(order_id):
    order = db.query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
    if not order:
        return redirect(url_for('index'))
    
    order_items = db.query_all("SELECT * FROM order_items WHERE order_id = %s", (order_id,))
    return render_template('order_success.html', order=order, items=order_items)

# API ENDPOINTS

@app.route('/api/categories', methods=['GET'])
def get_categories():
    department = request.args.get('department')
    if department:
        categories = db.query_all("SELECT * FROM categories WHERE department = %s ORDER BY name ASC", (department,))
    else:
        categories = db.query_all("SELECT * FROM categories ORDER BY department ASC, name ASC")
    return jsonify({'success': True, 'categories': categories})

@app.route('/api/products', methods=['GET'])
def get_products():
    try:
        department = request.args.get('department')
        category_id = request.args.get('category_id')
        query_str = request.args.get('q')
        is_featured = request.args.get('featured')
        
        save_data_header = (request.headers.get('Save-Data') or '').lower() == 'on'
        ect_header = (request.headers.get('ECT') or '').lower()
        tier_param = (request.args.get('tier') or '').lower()
        
        is_low_tier = save_data_header or ect_header in ['2g', 'slow-2g', '3g'] or tier_param == 'low'
        is_medium_tier = tier_param == 'medium' or ect_header == '3g'
        
        sql = "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1"
        params = []
        
        if department and department in ['food', 'dress']:
            sql += " AND p.department = %s"
            params.append(department)
            
        if category_id:
            sql += " AND p.category_id = %s"
            params.append(category_id)
            
        if is_featured and is_featured.lower() in ['1', 'true']:
            sql += " AND p.is_featured = 1"
            
        if query_str:
            sql += " AND (p.name LIKE %s OR p.description LIKE %s OR c.name LIKE %s)"
            like_str = f"%{query_str}%"
            params.extend([like_str, like_str, like_str])
            
        sql += " ORDER BY p.is_featured DESC, p.id ASC"
        
        products = db.query_all(sql, tuple(params))
        
        for p in products:
            if isinstance(p.get('attributes'), str):
                try:
                    p['attributes'] = json.loads(p['attributes'])
                except Exception:
                    p['attributes'] = {}
            elif not p.get('attributes'):
                p['attributes'] = {}

            if p.get('image_url') and 'unsplash.com' in p['image_url']:
                base_url = p['image_url'].split('?')[0]
                if is_low_tier:
                    p['image_url'] = f"{base_url}?auto=format&fit=crop&w=320&q=35&fm=webp"
                elif is_medium_tier:
                    p['image_url'] = f"{base_url}?auto=format&fit=crop&w=450&q=60&fm=webp"
                else:
                    p['image_url'] = f"{base_url}?auto=format&fit=crop&w=600&q=80"

        resp = make_response(jsonify({
            'success': True,
            'products': products,
            'count': len(products),
            'adaptive_tier': 'low' if is_low_tier else ('medium' if is_medium_tier else 'high'),
            'save_data': save_data_header
        }))

        if not is_low_tier and not save_data_header:
            resp.headers['Link'] = '</api/categories>; rel=prefetch'

        return resp
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = db.query_one("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = %s", (product_id,))
    if not product:
        return jsonify({'success': False, 'message': 'Product not found'}), 404
        
    if isinstance(product.get('attributes'), str):
        try:
            product['attributes'] = json.loads(product['attributes'])
        except Exception:
            product['attributes'] = {}
            
    return jsonify({'success': True, 'product': product})

@app.route('/api/orders', methods=['POST'])
def create_order():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'Invalid request body'}), 400
        
    customer_name = data.get('customer_name')
    customer_email = data.get('customer_email')
    customer_phone = data.get('customer_phone')
    shipping_address = data.get('shipping_address')
    payment_method = data.get('payment_method', 'Credit/Debit Card')
    cart_items = data.get('cart_items', [])
    
    if not customer_name or not customer_email or not customer_phone or not shipping_address or not cart_items:
        return jsonify({'success': False, 'message': 'Please fill out all required shipping and contact details'}), 400
        
    total_amount = 0.0
    items_to_insert = []
    
    for item in cart_items:
        prod_id = item.get('product_id')
        qty = int(item.get('quantity', 1))
        options = item.get('selected_options', '')
        
        product = db.query_one("SELECT * FROM products WHERE id = %s", (prod_id,))
        if product:
            price = float(product['price'])
            line_total = price * qty
            total_amount += line_total
            items_to_insert.append({
                'product_id': prod_id,
                'product_name': product['name'],
                'unit_price': price,
                'quantity': qty,
                'selected_options': options,
                'total_price': line_total
            })
            
    tax = round(total_amount * 0.08, 2)
    shipping = 4.99 if total_amount > 0 else 0.0
    grand_total = round(total_amount + tax + shipping, 2)
    
    order_number = "ORD-" + datetime.now().strftime("%Y%m%d") + "-" + str(uuid.uuid4())[:6].upper()
    
    order_id = db.execute_commit(
        """
        INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, shipping_address, payment_method, total_amount, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (order_number, customer_name, customer_email, customer_phone, shipping_address, payment_method, grand_total, 'Confirmed')
    )
    
    for item in items_to_insert:
        db.execute_commit(
            """
            INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, selected_options, total_price)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (order_id, item['product_id'], item['product_name'], item['unit_price'], item['quantity'], item['selected_options'], item['total_price'])
        )
        
    return jsonify({
        'success': True,
        'order_id': order_id,
        'order_number': order_number,
        'total_amount': grand_total,
        'message': 'Order successfully placed!'
    })

@app.route('/api/orders/<int:order_id>', methods=['GET'])
def get_order_details(order_id):
    order = db.query_one("SELECT * FROM orders WHERE id = %s", (order_id,))
    if not order:
        return jsonify({'success': False, 'message': 'Order not found'}), 404
        
    items = db.query_all("SELECT * FROM order_items WHERE order_id = %s", (order_id,))
    return jsonify({'success': True, 'order': order, 'items': items})

@app.route('/api/orders/search', methods=['GET'])
def search_order():
    query = request.args.get('q', '').strip()
    if not query:
        return jsonify({'success': False, 'message': 'Please enter an Order Number or Email.'}), 400
        
    order = db.query_one("SELECT * FROM orders WHERE order_number = %s OR customer_email = %s ORDER BY id DESC LIMIT 1", (query, query))
    if not order:
        return jsonify({'success': False, 'message': f'No order found matching "{query}".'}), 404
        
    items = db.query_all("SELECT * FROM order_items WHERE order_id = %s", (order['id'],))
    return jsonify({'success': True, 'order': order, 'items': items})

# AI STORE ASSISTANT ENDPOINT ("Chef & Stylist AI")

@app.route('/api/ai-assistant', methods=['POST'])
def ai_assistant():
    data = request.get_json() or {}
    user_prompt = (data.get('prompt') or '').strip().lower()
    
    if not user_prompt:
        return jsonify({
            'success': True,
            'reply': "Hello! I am your **Taste & Trend Chef & Stylist AI Assistant**. How can I help you today? Ask me for food pairings, vegetarian meals, party wear dresses, or budget recommendations!",
            'recommended_products': []
        })

    # Query all products from DB
    all_products = db.query_all("SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id")
    for p in all_products:
        if isinstance(p.get('attributes'), str):
            try:
                p['attributes'] = json.loads(p['attributes'])
            except Exception:
                p['attributes'] = {}
        elif not p.get('attributes'):
            p['attributes'] = {}

    recommended = []
    reply = ""

    # Check for budget limit in prompt (e.g. "under $50", "under 80", "below 20")
    budget_match = re.search(r'(under|below|less than|\$)\s*(\d+)', user_prompt)
    max_budget = float(budget_match.group(2)) if budget_match else None

    # Intent Classification
    if any(k in user_prompt for k in ['veg', 'vegan', 'vegetarian']):
        veg_items = [p for p in all_products if p['department'] == 'food' and p.get('attributes', {}).get('is_veg') is True]
        if max_budget:
            veg_items = [p for p in veg_items if float(p['price']) <= max_budget]
        recommended = veg_items[:3]
        reply = f"🌱 Here are top healthy vegetarian gourmet options{' under $' + str(max_budget) if max_budget else ''}:"

    elif any(k in user_prompt for k in ['pizza', 'pasta', 'italian']):
        items = [p for p in all_products if p['category_id'] == 1 or 'pizza' in p['name'].lower() or 'fettuccine' in p['name'].lower()]
        recommended = items[:3]
        reply = "🍕 Here are our artisanal wood-fired sourdough pizzas and handmade pastas:"

    elif any(k in user_prompt for k in ['burger', 'snack', 'bites', 'bacon']):
        items = [p for p in all_products if p['category_id'] == 2 or 'burger' in p['name'].lower()]
        recommended = items[:3]
        reply = "🍔 Check out these juicy Angus burgers and crispy savory bites:"

    elif any(k in user_prompt for k in ['dessert', 'cake', 'sweet', 'chocolate']):
        items = [p for p in all_products if p['category_id'] == 4 or 'cake' in p['name'].lower()]
        recommended = items[:3]
        reply = "🍰 Here are our decadent molten dark chocolate lava cakes and sweet desserts:"

    elif any(k in user_prompt for k in ['dress', 'gown', 'silk', 'party', 'formal', 'evening']):
        items = [p for p in all_products if p['department'] == 'dress' and (p['category_id'] == 7 or 'dress' in p['name'].lower())]
        if max_budget:
            items = [p for p in items if float(p['price']) <= max_budget]
        recommended = items[:3]
        reply = f"👗 Here are our elegant silk evening gowns and party dresses{' under $' + str(max_budget) if max_budget else ''}:"

    elif any(k in user_prompt for k in ['jacket', 'denim', 'coat', 'hoodie', 'outerwear']):
        items = [p for p in all_products if p['category_id'] == 9 or 'jacket' in p['name'].lower()]
        recommended = items[:3]
        reply = "🧥 Check out these timeless denim trucker jackets and outerwear:"

    elif any(k in user_prompt for k in ['ethnic', 'traditional', 'anarkali', 'suit', 'kurti']):
        items = [p for p in all_products if p['category_id'] == 8 or 'anarkali' in p['name'].lower()]
        recommended = items[:3]
        reply = "✨ Here are our hand-embroidered Anarkali suits and traditional designer wear:"

    elif max_budget:
        cheap_items = [p for p in all_products if float(p['price']) <= max_budget]
        recommended = cheap_items[:3]
        reply = f"💰 Great picks under **${max_budget:.2f}** from both Food and Fashion departments:"

    elif any(k in user_prompt for k in ['pair', 'recommend', 'combo', 'dinner', 'outfit', 'suggestion']):
        food_pick = [p for p in all_products if p['department'] == 'food' and p.get('is_featured')][:2]
        dress_pick = [p for p in all_products if p['department'] == 'dress' and p.get('is_featured')][:1]
        recommended = food_pick + dress_pick
        reply = "✨ I created a curated **Chef & Stylist Combo** featuring our top-rated culinary dish paired with designer fashion:"

    else:
        # Default top featured picks
        featured = [p for p in all_products if p.get('is_featured')][:3]
        recommended = featured
        reply = f"✨ I analyzed our catalog for **'{user_prompt}'**. Here are top recommended items you might love:"

    return jsonify({
        'success': True,
        'reply': reply,
        'recommended_products': recommended
    })

if __name__ == '__main__':
    print("Starting Adaptive Taste & Trend E-Commerce Server with AI Assistant...")
    app.run(debug=True, use_reloader=False, host='0.0.0.0', port=5000)