import streamlit as st
import os

st.title("🔍 Authentication Test")

st.write("### Checking environment...")

# Check if we're in Streamlit Cloud
if hasattr(st, 'secrets') and st.secrets:
    st.success("✅ Running in Streamlit Cloud")
    
    # Check for service account credentials
    if 'gcp_service_account' in st.secrets:
        st.success("✅ Service account credentials found in secrets")
        st.json(st.secrets.gcp_service_account)
    else:
        st.error("❌ No service account credentials in secrets")
else:
    st.info("ℹ️ Running locally")
    
    # Check for local credentials
    if os.path.exists('credentials.json'):
        st.success("✅ Local credentials.json found")
    else:
        st.warning("⚠️ No local credentials.json found")

# Test Google Sheets API
st.write("### Testing Google Sheets API...")

try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    import pickle
    
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
    
    def test_google_sheets():
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
                # Try to get credentials from Streamlit secrets
                if hasattr(st, 'secrets') and st.secrets and 'gcp_service_account' in st.secrets:
                    from google.oauth2 import service_account
                    service_account_info = dict(st.secrets.gcp_service_account)
                    creds = service_account.Credentials.from_service_account_info(
                        service_account_info, 
                        scopes=SCOPES
                    )
                    st.success("✅ Created credentials from Streamlit secrets")
                else:
                    # Fallback to local credentials.json
                    if os.path.exists('credentials.json'):
                        flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
                        creds = flow.run_local_server(port=0)
                        st.success("✅ Created credentials from local file")
                    else:
                        st.error("❌ No credentials available")
                        return None
        
        # Build the service
        service = build('sheets', 'v4', credentials=creds)
        st.success("✅ Google Sheets service created successfully")
        return service
    
    service = test_google_sheets()
    if service:
        st.success("🎉 Google Sheets API is working!")
    else:
        st.error("❌ Failed to create Google Sheets service")
        
except Exception as e:
    st.error(f"❌ Error: {e}")
    st.exception(e) 