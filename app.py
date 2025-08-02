import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, date
import json
import os
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import pickle

# Page configuration
st.set_page_config(
    page_title="Hotel Management System",
    page_icon="🏨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Item categories with prices (in Kenyan Shillings)
ITEM_PRICES = {
    "Snacks": {
        "Chapo": 30,
        "Ndazi": 20,
        "Tm": 30,
        "Cake": 30,
        "Hcake": 30,
        "Eggs": 40,
        "Omelet": 50,
        "Sausage/Smokie": 50
    },
    "Food": {
        "ChapoMix": 90,
        "Walimix": 150,
        "Ugalimix": 150,
        "PilauMix": 180,
        "ChapoMinji": 140,
        "Waliminji": 200,
        "Ugaliminji": 200,
        "PilauMinji": 200,
        "BeefChapo": 190,
        "BeefUgali": 250,
        "BeefRice": 250,
        "BeefPilau": 300,
        "UgaliMatumbo": 200,
        "RiceMatumbo": 200,
        "ChapoMatumbo": 140,
        "PilauMatumbo": 200,
        "UgaliManagu": 150,
        "RiceManagu": 150,
        "ChapoManagu": 90,
        "PilauManagu": 200,
        "UgaliFryManagu": 300,
        "RiceFryManagu": 300,
        "ChapoFryManagu": 240,
        "PilauFryManagu": 300,
        "UgaliMatumboManagu": 200,
        "RiceMatumboManagu": 200,
        "ChapoMatumboManagu": 200,
        "PilauMatumboManagu": 200,
        "UgaliMboga": 100,
        "RiceMboga": 100,
        "ChapoMboga": 40,
        "UgaliPlain": 50,
        "MchelePlain": 100,
        "PilauPlain": 100,
        "ServiceNyama": 75
    },
    "Kuku": {
        "KukuChapo": 290,
        "KukuUgali": 350,
        "KukuRice": 350,
        "KukuPilau": 400,
        "UgaliKukuManagu": 400,
        "RiceKukuManagu": 400,
        "ChapoKukuManagu": 340,
        "PilauKukuManagu": 400
    },
    "Drinks": {
        "BlackCoffee": 30,
        "WhiteCoffee": 50,
        "LemonTea": 30,
        "Concusion": 50,
        "Predator": 70,
        "Soda": 50,
        "PlasticSoda": 50,
        "Dasani_.5ltr": 50,
        "Dasani_1ltr": 100,
        "Water_.5ltr": 40,
        "Water_1ltr": 80,
        "MinuteMaid": 80
    },
    "No. cups of tea": {
        "Tea": 30
    }
}

# Password for price editing
PRICE_EDIT_PASSWORD = "bushman"

# Google Sheets API setup
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# Predefined Google Sheets configuration
PREDEFINED_SPREADSHEET_ID = "1rEZbc1CroKxW99H7AtsISZMY2wWK6430W2GAKfV2J3M"
PREDEFINED_SALES_SHEET = "Sales_data"
PREDEFINED_PRICE_SHEET = "December"

def get_google_sheets_service():
    """Initialize Google Sheets API service"""
    creds = None
    
    # Check if token.pickle exists
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    # If credentials don't exist or are invalid, get new ones
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if os.path.exists('credentials.json'):
                flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                creds = flow.run_local_server(port=0)
            else:
                st.error("credentials.json file not found. Please set up Google Sheets API credentials.")
                return None
        
        # Save credentials for next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    return build('sheets', 'v4', credentials=creds)

def read_sales_data(spreadsheet_id, range_name):
    """Read sales data from Google Sheets with items as columns and dates as rows"""
    try:
        service = get_google_sheets_service()
        if service is None:
            return pd.DataFrame()
        
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        values = result.get('values', [])
        if not values:
            return pd.DataFrame()
        
        # First row contains column headers (Date, item1, item2, ..., Amount)
        headers = values[0]
        df = pd.DataFrame(values[1:], columns=headers)
        
        # Convert to the format expected by the app
        sales_records = []
        
        for index, row in df.iterrows():
            date_str = row.get('Date', '')
            if not date_str:
                continue
                
            try:
                sale_date = pd.to_datetime(date_str)
            except:
                continue
            
            # Process each item column (skip Date and Amount columns)
            for column in df.columns:
                if column not in ['Date', 'Amount']:
                    quantity = row.get(column, 0)
                    
                    # Convert quantity to numeric, skip if 0 or empty
                    try:
                        quantity = float(quantity) if quantity else 0
                        if quantity > 0:
                            # Find the price for this item
                            price = 0
                            category = ""
                            
                            # Search for item in item_prices
                            for cat, items in st.session_state.item_prices.items():
                                if column in items:
                                    price = items[column]
                                    category = cat
                                    break
                            
                            # Create sales record
                            sales_records.append({
                                'Date': sale_date,
                                'Item': column,
                                'Quantity': quantity,
                                'Price': price,
                                'Total': quantity * price,
                                'Category': category
                            })
                    except (ValueError, TypeError):
                        continue
        
        return pd.DataFrame(sales_records)
        
    except Exception as e:
        st.error(f"Error reading from Google Sheets: {e}")
        return pd.DataFrame()

def read_price_data(spreadsheet_id, range_name="price_data!A:B"):
    """Read price data from Google Sheets with Item and Price columns"""
    try:
        service = get_google_sheets_service()
        if service is None:
            return ITEM_PRICES  # Return default prices if service unavailable
        
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        values = result.get('values', [])
        if not values:
            return ITEM_PRICES  # Return default prices if no data
        
        # Convert sheet data to ITEM_PRICES format
        prices = {}
        
        # First, create a mapping of items to their categories from the default ITEM_PRICES
        item_to_category = {}
        for category, items in ITEM_PRICES.items():
            for item in items.keys():
                item_to_category[item] = category
        
        # Process the price data
        for row in values[1:]:  # Skip header row
            if len(row) >= 2:
                item = row[0]
                price = float(row[1]) if row[1] else 0
                
                # Find the category for this item
                category = item_to_category.get(item, "Other")
                
                if category not in prices:
                    prices[category] = {}
                prices[category][item] = price
        
        return prices if prices else ITEM_PRICES
    except Exception as e:
        st.error(f"Error reading price data from Google Sheets: {e}")
        return ITEM_PRICES  # Return default prices on error

def write_sales_data(spreadsheet_id, range_name, data):
    """Write sales data to Google Sheets"""
    try:
        service = get_google_sheets_service()
        if service is None:
            return False
        
        # Prepare data for writing
        values = [data]
        
        body = {
            'values': values
        }
        
        result = service.spreadsheets().values().append(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption='USER_ENTERED',
            insertDataOption='INSERT_ROWS',
            body=body
        ).execute()
        
        return True
    except Exception as e:
        st.error(f"Error writing to Google Sheets: {e}")
        return False

def write_price_data(spreadsheet_id, prices, range_name="price_data!A:B"):
    """Write price data to Google Sheets with Item and Price columns"""
    try:
        service = get_google_sheets_service()
        if service is None:
            return False
        
        # Prepare data for writing
        values = [['Item', 'Price']]  # Header row
        
        for category, items in prices.items():
            for item, price in items.items():
                values.append([item, price])
        
        body = {
            'values': values
        }
        
        # Clear existing data and write new data
        service.spreadsheets().values().clear(
            spreadsheetId=spreadsheet_id,
            range=range_name
        ).execute()
        
        result = service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption='USER_ENTERED',
            body=body
        ).execute()
        
        return True
    except Exception as e:
        st.error(f"Error writing price data to Google Sheets: {e}")
        return False

def save_prices_to_file(prices, filename="item_prices.json"):
    """Save prices to local JSON file"""
    try:
        with open(filename, 'w') as f:
            json.dump(prices, f, indent=2)
        return True
    except Exception as e:
        st.error(f"Error saving prices: {e}")
        return False

def load_prices_from_file(filename="item_prices.json"):
    """Load prices from local JSON file"""
    try:
        if os.path.exists(filename):
            with open(filename, 'r') as f:
                return json.load(f)
        return ITEM_PRICES
    except Exception as e:
        st.error(f"Error loading prices: {e}")
        return ITEM_PRICES

def initialize_session_state():
    """Initialize session state variables"""
    if 'sales_data' not in st.session_state:
        st.session_state.sales_data = []
    if 'item_prices' not in st.session_state:
        st.session_state.item_prices = load_prices_from_file()
    if 'price_edit_authenticated' not in st.session_state:
        st.session_state.price_edit_authenticated = False
    if 'selected_category' not in st.session_state:
        st.session_state.selected_category = "Snacks"
    if 'selected_item' not in st.session_state:
        st.session_state.selected_item = "Chapo"
    if 'spreadsheet_id' not in st.session_state:
        st.session_state.spreadsheet_id = PREDEFINED_SPREADSHEET_ID
    if 'sheet_name' not in st.session_state:
        st.session_state.sheet_name = PREDEFINED_SALES_SHEET
    if 'price_sheet_name' not in st.session_state:
        st.session_state.price_sheet_name = PREDEFINED_PRICE_SHEET
    if 'bulk_entries' not in st.session_state:
        st.session_state.bulk_entries = []
    if 'bulk_selected_category' not in st.session_state:
        st.session_state.bulk_selected_category = "Snacks"
    if 'bulk_selected_item' not in st.session_state:
        st.session_state.bulk_selected_item = "Chapo"

def authenticate_price_edit():
    """Authenticate user for price editing"""
    password = st.text_input("Enter password to edit prices:", type="password")
    if st.button("Authenticate"):
        if password == PRICE_EDIT_PASSWORD:
            st.session_state.price_edit_authenticated = True
            st.success("Authentication successful! You can now edit prices.")
            st.rerun()
        else:
            st.error("Incorrect password. Please try again.")

def main():
    initialize_session_state()
    
    # Header
    st.title("🏨 Hotel Management System")
    st.markdown("---")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        # Google Sheets setup (predefined)
        st.subheader("Google Sheets Setup")
        st.info(f"**Spreadsheet ID:** {PREDEFINED_SPREADSHEET_ID}")
        st.info(f"**Sales Sheet:** {PREDEFINED_SALES_SHEET}")
        st.info(f"**Price Sheet:** {PREDEFINED_PRICE_SHEET}")
        
        # Load data buttons
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("📥 Load Sales Data"):
                range_name = f"{PREDEFINED_SALES_SHEET}!A:AZ"
                df = read_sales_data(PREDEFINED_SPREADSHEET_ID, range_name)
                if not df.empty:
                    st.session_state.sales_data = df.to_dict('records')
                    st.success(f"Sales data loaded successfully! {len(df)} records found.")
                else:
                    st.warning("No sales data found or error loading data.")
        
        with col2:
            if st.button("💰 Load Price Data"):
                price_range = f"{PREDEFINED_PRICE_SHEET}!A:B"
                prices = read_price_data(PREDEFINED_SPREADSHEET_ID, price_range)
                st.session_state.item_prices = prices
                st.success("Price data loaded successfully!")
        
        # Save data buttons
        col1, col2 = st.columns(2)
        
        with col1:
            if st.button("💾 Save Sales to Sheets"):
                if st.session_state.sales_data:
                    range_name = f"{PREDEFINED_SALES_SHEET}!A:AZ"
                    # This would need to be implemented based on your sheet format
                    st.info("Sales data saving to Google Sheets will be implemented based on your data format.")
                else:
                    st.error("No sales data to save.")
        
        with col2:
            if st.button("💾 Save Prices to Sheets"):
                price_range = f"{PREDEFINED_PRICE_SHEET}!A:B"
                if write_price_data(PREDEFINED_SPREADSHEET_ID, st.session_state.item_prices, price_range):
                    st.success("Prices saved to Google Sheets successfully!")
                else:
                    st.error("Failed to save prices to Google Sheets.")
        
        st.markdown("---")
        
        # Price management
        st.subheader("💰 Price Management")
        
        if not st.session_state.price_edit_authenticated:
            if st.button("🔐 Edit Prices"):
                st.session_state.show_price_auth = True
        
        if st.session_state.price_edit_authenticated:
            if st.button("🔒 Lock Price Editing"):
                st.session_state.price_edit_authenticated = False
                st.session_state.show_price_auth = False
                st.rerun()
        
        # Save prices to local file button
        if st.button("💾 Save Prices to File"):
            if save_prices_to_file(st.session_state.item_prices):
                st.success("Prices saved to local file successfully!")
            else:
                st.error("Failed to save prices to local file.")
        
        st.markdown("---")
        
        # Quick stats
        if st.session_state.sales_data:
            st.subheader("📊 Quick Stats")
            df = pd.DataFrame(st.session_state.sales_data)
            if not df.empty:
                total_sales = df['Total'].sum()
                total_items = df['Quantity'].sum()
                st.metric("Total Sales", f"KSh {total_sales:,.2f}")
                st.metric("Total Items Sold", f"{total_items:,}")
    
    # Main content area
    tab1, tab2, tab3, tab4, tab5 = st.tabs(["📝 Sales Data", "📋 Current Sales", "📊 Analytics", "💰 Price Management", "ℹ️ Info"])
    
    with tab1:
        st.header("📝 Sales Data")
        st.markdown("Add multiple sales entries for a whole day and save them all at once.")
        
        # Initialize bulk entries in session state
        if 'bulk_entries' not in st.session_state:
            st.session_state.bulk_entries = []
        
        # Initialize bulk selection state
        if 'bulk_selected_category' not in st.session_state:
            st.session_state.bulk_selected_category = "Snacks"
        if 'bulk_selected_item' not in st.session_state:
            st.session_state.bulk_selected_item = "Chapo"
        
        # Date selection for bulk entry
        bulk_date = st.date_input("Date for all entries", value=date.today(), key="bulk_date")
        
        # Category and Item selection (outside form for better reactivity)
        col1, col2 = st.columns(2)
        
        with col1:
            # Category selection with callback
            bulk_category = st.selectbox(
                "Category", 
                list(st.session_state.item_prices.keys()),
                key="bulk_category_select",
                index=list(st.session_state.item_prices.keys()).index(st.session_state.bulk_selected_category)
            )
            
            # Update selected category when changed
            if bulk_category != st.session_state.bulk_selected_category:
                st.session_state.bulk_selected_category = bulk_category
                items_in_category = list(st.session_state.item_prices[bulk_category].keys())
                st.session_state.bulk_selected_item = items_in_category[0] if items_in_category else ""
        
        with col2:
            # Item selection based on category with callback
            bulk_items = list(st.session_state.item_prices[bulk_category].keys())
            if bulk_items:
                current_item_index = 0
                if st.session_state.bulk_selected_item in bulk_items:
                    current_item_index = bulk_items.index(st.session_state.bulk_selected_item)
                
                bulk_item = st.selectbox(
                    "Item", 
                    bulk_items,
                    key=f"bulk_item_select_{bulk_category}",
                    index=current_item_index
                )
                st.session_state.bulk_selected_item = bulk_item
            else:
                bulk_item = ""
                st.warning("No items available in this category.")
        
        # Bulk entry form
        with st.form("bulk_entry"):
            st.subheader("Add New Entry")
            
            # Display selected category and item (read-only)
            col1, col2 = st.columns(2)
            with col1:
                st.write(f"**Selected Category:** {bulk_category}")
            with col2:
                st.write(f"**Selected Item:** {bulk_item}")
            
            col3, col4 = st.columns(2)
            
            with col3:
                bulk_quantity = st.number_input("Quantity", min_value=1, value=1, step=1, key="bulk_quantity")
                
                # Auto-fill price based on selected item
                if bulk_item and bulk_category:
                    bulk_selected_price = st.session_state.item_prices[bulk_category][bulk_item]
                    bulk_price = st.number_input("Price per unit (KSh)", min_value=0.0, value=float(bulk_selected_price), step=1.0, key="bulk_price")
                else:
                    bulk_price = st.number_input("Price per unit (KSh)", min_value=0.0, value=0.0, step=1.0, key="bulk_price")
            
            with col4:
                bulk_total = bulk_quantity * bulk_price
                st.metric("Total (KSh)", f"{bulk_total:.2f}")
                
                # Additional notes
                bulk_notes = st.text_area("Notes (optional)", key="bulk_notes")
            
            add_entry = st.form_submit_button("➕ Add to Sales List")
            
            if add_entry:
                if bulk_price <= 0:
                    st.error("Please enter a valid price.")
                elif not bulk_item:
                    st.error("Please select an item.")
                else:
                    # Create bulk entry record
                    bulk_entry = {
                        'Date': f"{bulk_date} 00:00:00",  # Use 00:00:00 for bulk entries
                        'Item': bulk_item,
                        'Quantity': bulk_quantity,
                        'Price': bulk_price,
                        'Total': bulk_total,
                        'Category': bulk_category,
                        'Notes': bulk_notes
                    }
                    
                    # Add to bulk entries
                    st.session_state.bulk_entries.append(bulk_entry)
                    st.success(f"Added {bulk_item} to sales list!")
                    st.rerun()
        
        # Display current bulk entries
        if st.session_state.bulk_entries:
            st.subheader("📋 Current Sales Entries")
            
            # Create DataFrame for display
            bulk_df = pd.DataFrame(st.session_state.bulk_entries)
            
            # Show summary
            total_bulk_sales = bulk_df['Total'].sum()
            total_bulk_items = bulk_df['Quantity'].sum()
            
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Entries", len(st.session_state.bulk_entries))
            with col2:
                st.metric("Total Sales", f"KSh {total_bulk_sales:,.2f}")
            with col3:
                st.metric("Total Items", total_bulk_items)
            
            # Display entries table
            st.dataframe(
                bulk_df,
                use_container_width=True,
                hide_index=True
            )
            
            # Action buttons
            col1, col2, col3 = st.columns(3)
            
            with col1:
                if st.button("💾 Save All to Database", type="primary"):
                    # Add all bulk entries to main sales data
                    st.session_state.sales_data.extend(st.session_state.bulk_entries)
                    
                    # Save to Google Sheets if configured
                    if st.session_state.spreadsheet_id:
                        try:
                            # First, read the existing sheet structure to get column order
                            service = get_google_sheets_service()
                            if service is None:
                                st.error("Google Sheets service not available")
                                return
                            
                            # Read the header row to get column order
                            header_result = service.spreadsheets().values().get(
                                spreadsheetId=st.session_state.spreadsheet_id,
                                range=f"{st.session_state.sheet_name}!A1:AZ1"
                            ).execute()
                            
                            header_values = header_result.get('values', [[]])
                            if not header_values or not header_values[0]:
                                st.error("Could not read sheet headers")
                                return
                            
                            column_headers = header_values[0]
                            
                            # Group entries by date and item
                            date_item_quantities = {}
                            for entry in st.session_state.bulk_entries:
                                date_str = entry['Date'].split()[0]  # Get just the date part
                                item = entry['Item']
                                quantity = entry['Quantity']
                                
                                if date_str not in date_item_quantities:
                                    date_item_quantities[date_str] = {}
                                
                                if item not in date_item_quantities[date_str]:
                                    date_item_quantities[date_str][item] = 0
                                
                                date_item_quantities[date_str][item] += quantity
                            
                            # Save each date's data as a row
                            saved_count = 0
                            for date_str, item_quantities in date_item_quantities.items():
                                # Create row data matching the exact column structure
                                row_data = []
                                
                                # Define the exact column order from the user's sheet
                                exact_columns = [
                                    'Date', 'chapo', 'Ndazi', 'Tm', 'cake', 'Hcake', 'Eggs', 'Omelet', 'Sausage/Smokie',
                                    'ChapoMix', 'Walimix', 'Ugalimix', 'PilauMix', 'ChapoMinji', 'Waliminji', 
                                    'Ugaliminji', 'PilauMinji', 'BeefChapo', 'BeefUgali', 'BeefRice', 'BeefPilau',
                                    'KukuChapo', 'KukuUgali', 'KukuRice', 'KukuPilau', 'UgaliMatumbo', 'RiceMatumbo',
                                    'ChapoMatumbo', 'PilauMatumbo', 'UgaliManagu', 'RiceManagu', 'ChapoManagu',
                                    'PilauManagu', 'UgaliFryManagu', 'RiceFryManagu', 'ChapoFryManagu', 'PilauFryManagu',
                                    'UgaliKukuManagu', 'RiceUgaliKukuManagu', 'ChapoUgaliKukuManagu', 'PilauUgaliKukuManagu',
                                    'UgaliMatumboManagu', 'RiceMatumboManagu', 'ChapoMatumboManagu', 'PilauMatumboManagu',
                                    'UgaliMboga', 'RiceMboga', 'ChapoMboga', 'UgaliPlain', 'MchelePlain', 'PilauPlain',
                                    'ServiceNyama', 'Tea', 'BlackCoffee', 'WhiteCofee', 'LemonTea', 'Concusion',
                                    'Predator', 'Soda', 'PlasticSoda', 'Dasani_.5ltr', 'Dasani_1ltr', 'Water_.5ltr',
                                    'Water_1ltr', 'MinuteMaid', 'Amount'
                                ]
                                
                                # Fill in data according to exact column structure
                                for column in exact_columns:
                                    if column == 'Date':
                                        row_data.append(date_str)
                                    elif column == 'Amount':
                                        # Calculate total amount for this date
                                        total_amount = 0
                                        for item, quantity in item_quantities.items():
                                            # Find the price for this item
                                            for category, items in st.session_state.item_prices.items():
                                                if item in items:
                                                    total_amount += quantity * items[item]
                                                    break
                                        row_data.append(total_amount)
                                    else:
                                        # This is an item column - check if the item name matches exactly
                                        quantity = item_quantities.get(column, 0)
                                        row_data.append(quantity)
                                
                                # Save the row to Google Sheets
                                success = write_sales_data(
                                    st.session_state.spreadsheet_id,
                                    f"{st.session_state.sheet_name}!A:AZ",
                                    row_data
                                )
                                if success:
                                    saved_count += 1
                            
                            if saved_count > 0:
                                st.success(f"Successfully saved {saved_count} date entries to Google Sheets!")
                            else:
                                st.warning("Failed to save to Google Sheets. Check your connection.")
                        except Exception as e:
                            st.error(f"Error saving to Google Sheets: {e}")
                    else:
                        st.success(f"Successfully saved {len(st.session_state.bulk_entries)} entries locally!")
                    
                    # Clear bulk entries
                    st.session_state.bulk_entries = []
                    st.rerun()
            
            with col2:
                if st.button("🗑️ Clear All Sales Entries"):
                    st.session_state.bulk_entries = []
                    st.rerun()
            
            with col3:
                # Export bulk entries to CSV
                csv = bulk_df.to_csv(index=False)
                st.download_button(
                    "📥 Download Sales CSV",
                    csv,
                    f"sales_data_{bulk_date}.csv",
                    "text/csv"
                )
        else:
            st.info("No sales entries yet. Add some entries using the form above.")
    
    with tab2:
        st.header("📋 Current Sales")
        
        if st.session_state.sales_data:
            df = pd.DataFrame(st.session_state.sales_data)
            
            # Filters
            col1, col2, col3 = st.columns(3)
            
            with col1:
                date_filter = st.date_input(
                    "Filter by Date",
                    value=date.today(),
                    help="Show sales for specific date"
                )
            
            with col2:
                category_filter = st.selectbox(
                    "Filter by Category",
                    ["All"] + list(st.session_state.item_prices.keys())
                )
            
            with col3:
                all_items = []
                for category_items in st.session_state.item_prices.values():
                    all_items.extend(category_items.keys())
                item_filter = st.selectbox(
                    "Filter by Item",
                    ["All"] + all_items
                )
            
            # Apply filters
            filtered_df = df.copy()
            
            if date_filter:
                filtered_df = filtered_df[pd.to_datetime(filtered_df['Date']).dt.date == date_filter]
            
            if category_filter != "All":
                filtered_df = filtered_df[filtered_df['Category'] == category_filter]
            
            if item_filter != "All":
                filtered_df = filtered_df[filtered_df['Item'] == item_filter]
            
            # Display data
            if not filtered_df.empty:
                st.dataframe(
                    filtered_df,
                    use_container_width=True,
                    hide_index=True
                )
                
                # Export options
                col1, col2 = st.columns(2)
                with col1:
                    csv = filtered_df.to_csv(index=False)
                    st.download_button(
                        "📥 Download CSV",
                        csv,
                        "sales_data.csv",
                        "text/csv"
                    )
                
                with col2:
                    if st.button("🗑️ Clear All Data"):
                        st.session_state.sales_data = []
                        st.rerun()
            else:
                st.info("No sales data found for the selected filters.")
        else:
            st.info("No sales data available. Start by adding some sales in the Sales Entry tab.")
    
    with tab3:
        st.header("📊 Analytics")
        
        if st.session_state.sales_data:
            df = pd.DataFrame(st.session_state.sales_data)
            df['Date'] = pd.to_datetime(df['Date'])
            
            # Date filter for analytics
            st.subheader("📅 Date Filter")
            col1, col2 = st.columns(2)
            
            with col1:
                analytics_start_date = st.date_input(
                    "Start Date",
                    value=df['Date'].dt.date.min(),
                    help="Select start date for analysis"
                )
            
            with col2:
                analytics_end_date = st.date_input(
                    "End Date",
                    value=df['Date'].dt.date.max(),
                    help="Select end date for analysis"
                )
            
            # Apply date filter
            if analytics_start_date and analytics_end_date:
                filtered_df = df[
                    (df['Date'].dt.date >= analytics_start_date) & 
                    (df['Date'].dt.date <= analytics_end_date)
                ]
            else:
                filtered_df = df
            
            if not filtered_df.empty:
                # Summary statistics
                col1, col2, col3, col4 = st.columns(4)
                
                with col1:
                    total_sales = filtered_df['Total'].sum()
                    st.metric("Total Sales", f"KSh {total_sales:,.2f}")
                
                with col2:
                    total_items = filtered_df['Quantity'].sum()
                    st.metric("Total Items", f"{total_items:,}")
                
                with col3:
                    avg_order = filtered_df['Total'].mean()
                    st.metric("Avg Order", f"KSh {avg_order:.2f}")
                
                with col4:
                    total_orders = len(filtered_df)
                    st.metric("Total Orders", f"{total_orders:,}")
                
                # Charts
                col1, col2 = st.columns(2)
                
                with col1:
                    # Sales by category
                    category_sales = filtered_df.groupby('Category')['Total'].sum().reset_index()
                    fig_category = px.pie(
                        category_sales,
                        values='Total',
                        names='Category',
                        title='Sales by Category'
                    )
                    st.plotly_chart(fig_category, use_container_width=True)
                
                with col2:
                    # Top 3 items per category
                    top_items_by_category = []
                    
                    for category in filtered_df['Category'].unique():
                        category_data = filtered_df[filtered_df['Category'] == category]
                        top_items = category_data.groupby('Item')['Quantity'].sum().sort_values(ascending=False).head(3)
                        
                        for item, quantity in top_items.items():
                            top_items_by_category.append({
                                'Category': category,
                                'Item': item,
                                'Quantity': quantity
                            })
                    
                    if top_items_by_category:
                        top_items_df = pd.DataFrame(top_items_by_category)
                        
                        # Create bar chart with category grouping
                        fig_items = px.bar(
                            top_items_df,
                            x='Quantity',
                            y='Item',
                            color='Category',
                            orientation='h',
                            title='Top 3 Items per Category',
                            barmode='group'
                        )
                        fig_items.update_layout(
                            xaxis_title='Quantity Sold',
                            yaxis_title='Item',
                            height=400
                        )
                        st.plotly_chart(fig_items, use_container_width=True)
                    else:
                        st.info("No data available for item analysis.")
                
                # Daily sales trend
                daily_sales = filtered_df.groupby(filtered_df['Date'].dt.date)['Total'].sum().reset_index()
                daily_sales['Date'] = pd.to_datetime(daily_sales['Date'])
                
                fig_trend = px.line(
                    daily_sales,
                    x='Date',
                    y='Total',
                    title='Daily Sales Trend'
                )
                st.plotly_chart(fig_trend, use_container_width=True)
                
            else:
                st.warning(f"No data available for the selected date range ({analytics_start_date} to {analytics_end_date}).")
                
        else:
            st.info("No data available for analytics. Add some sales first.")
    
    with tab4:
        st.header("💰 Price Management")
        
        if not st.session_state.price_edit_authenticated:
            st.warning("🔐 Authentication required to edit prices")
            authenticate_price_edit()
        else:
            st.success("✅ Authenticated - You can edit prices")
            
            # Price editing interface
            st.subheader("Edit Item Prices")
            
            # Category selection for price editing
            edit_category = st.selectbox("Select Category to Edit", list(st.session_state.item_prices.keys()), key="edit_category")
            
            if edit_category:
                st.write(f"**Editing prices for {edit_category}:**")
                
                # Create columns for price editing
                items = list(st.session_state.item_prices[edit_category].keys())
                num_cols = 3
                cols = st.columns(num_cols)
                
                for i, item in enumerate(items):
                    col_idx = i % num_cols
                    with cols[col_idx]:
                        new_price = st.number_input(
                            f"{item} (KSh)",
                            value=float(st.session_state.item_prices[edit_category][item]),
                            min_value=0.0,
                            step=1.0,
                            key=f"price_{item}"
                        )
                        st.session_state.item_prices[edit_category][item] = new_price
                
                # Save prices button
                if st.button("💾 Save Price Changes"):
                    if save_prices_to_file(st.session_state.item_prices):
                        st.success("Prices updated successfully!")
                    else:
                        st.error("Failed to save price changes.")
    
    with tab5:
        st.header("⚙️ Setup Instructions")
        
        st.markdown("""
        ### Google Sheets API Setup
        
        1. **Create a Google Cloud Project**:
           - Go to [Google Cloud Console](https://console.cloud.google.com/)
           - Create a new project or select existing one
        
        2. **Enable Google Sheets API**:
           - Go to "APIs & Services" > "Library"
           - Search for "Google Sheets API" and enable it
        
        3. **Create Credentials**:
           - Go to "APIs & Services" > "Credentials"
           - Click "Create Credentials" > "OAuth 2.0 Client IDs"
           - Choose "Desktop application"
           - Download the JSON file and rename it to `credentials.json`
           - Place it in the same folder as this app
        
        4. **Create Google Sheet**:
           - Create a new Google Sheet
           - Copy the Spreadsheet ID from the URL
           - Add the following headers in the first row:
             - Date, Item, Quantity, Price, Total, Category, Notes
        
        5. **Configure the App**:
           - Enter the Spreadsheet ID in the sidebar
           - Set the sheet name (default: "Sales")
           - Click "Load Data from Google Sheets"
        
        ### File Structure
        ```
        your-project/
        ├── app.py
        ├── requirements.txt
        ├── credentials.json
        ├── item_prices.json
        ├── token.pickle (will be created automatically)
        └── README.md
        ```
        
        ### 🔐 Price Management:
        - Password: **bushman**
        - Edit prices in the "Price Management" tab
        - Changes are saved automatically
        """)
        
        # Display current configuration
        st.subheader("Current Configuration")
        st.write(f"**Spreadsheet ID:** {st.session_state.spreadsheet_id or 'Not set'}")
        st.write(f"**Sheet Name:** {st.session_state.sheet_name}")
        st.write(f"**Credentials File:** {'✅ Found' if os.path.exists('credentials.json') else '❌ Missing'}")
        st.write(f"**Token File:** {'✅ Found' if os.path.exists('token.pickle') else '❌ Not authenticated'}")
        
        # Display item categories with prices
        st.subheader("Item Categories and Prices")
        for category, items in st.session_state.item_prices.items():
            st.markdown(f"**{category}** ({len(items)} items):")
            for item, price in items.items():
                st.write(f"  - {item}: KSh {price:,}")
            st.write("")

if __name__ == "__main__":
    main() 