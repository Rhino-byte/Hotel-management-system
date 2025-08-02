import streamlit as st
import json
import os

st.title("🔍 Google Sheets API Diagnostic Tool")

st.write("### 1. Checking Credentials File...")

# Check if credentials.json exists
if os.path.exists('credentials.json'):
    st.success("✅ credentials.json found")
    
    # Read and validate credentials
    try:
        with open('credentials.json', 'r') as f:
            creds_data = json.load(f)
        
        required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email']
        missing_fields = [field for field in required_fields if field not in creds_data]
        
        if missing_fields:
            st.error(f"❌ Missing fields in credentials.json: {missing_fields}")
        else:
            st.success("✅ All required fields present in credentials.json")
            st.write(f"**Project ID:** {creds_data.get('project_id', 'Not found')}")
            st.write(f"**Client Email:** {creds_data.get('client_email', 'Not found')}")
            
    except json.JSONDecodeError:
        st.error("❌ credentials.json is not valid JSON")
    except Exception as e:
        st.error(f"❌ Error reading credentials.json: {e}")
else:
    st.error("❌ credentials.json not found")

st.write("### 2. Checking Google Sheets API Setup...")

st.info("""
**To enable Google Sheets API:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **argon-rider-467801-q2**
3. Go to "APIs & Services" > "Library"
4. Search for "Google Sheets API"
5. Click on it and press "Enable"
6. Go to "APIs & Services" > "Credentials"
7. Make sure your service account has the necessary permissions
""")

st.write("### 3. Checking Google Sheets Sharing...")

st.info("""
**To share your Google Sheets:**

1. Open your Google Sheet: **1rEZbc1CroKxW99H7AtsISZMY2wWK6430W2GAKfV2J3M**
2. Click "Share" button
3. Add this email: **hotel-management-system@argon-rider-467801-q2.iam.gserviceaccount.com**
4. Give "Editor" permissions
5. Click "Send"
""")

st.write("### 4. Testing Authentication...")

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
    
    # Try to create credentials
    creds = service_account.Credentials.from_service_account_file(
        'credentials.json', 
        scopes=SCOPES
    )
    st.success("✅ Service account credentials created successfully")
    
    # Try to build the service
    service = build('sheets', 'v4', credentials=creds)
    st.success("✅ Google Sheets service created successfully")
    
    # Try to access a spreadsheet (this will test permissions)
    try:
        # Test with your spreadsheet ID
        spreadsheet_id = "1rEZbc1CroKxW99H7AtsISZMY2wWK6430W2GAKfV2J3M"
        result = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        st.success("✅ Successfully accessed Google Sheets!")
        st.write(f"**Sheet Title:** {result.get('properties', {}).get('title', 'Unknown')}")
    except Exception as e:
        st.error(f"❌ Cannot access Google Sheets: {e}")
        st.info("This usually means the sheet is not shared with the service account email")
        
except Exception as e:
    st.error(f"❌ Authentication failed: {e}")

st.write("### 5. Common Issues Checklist:")

st.write("""
- ✅ **Service Account Created** - You have this
- ✅ **API Key Generated** - You have this  
- ❓ **Google Sheets API Enabled** - Check in Google Cloud Console
- ❓ **Google Sheets Shared** - Add service account email with Editor permissions
- ❓ **Billing Enabled** - Required for API usage
- ❓ **Project Active** - Make sure project is not suspended
""")

st.write("### 6. Next Steps:")

st.write("""
1. **Enable Google Sheets API** in Google Cloud Console
2. **Share your Google Sheets** with the service account email
3. **Enable billing** if not already done
4. **Test the app again**
""") 