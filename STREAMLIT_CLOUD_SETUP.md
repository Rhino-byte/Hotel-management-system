# 🚀 Streamlit Cloud Deployment Guide

## 📋 **Prerequisites**
- ✅ GitHub repository: `Rhino-byte/Hotel-management-system`
- ✅ Google Cloud Project with Google Sheets API enabled
- ✅ Google Service Account or OAuth 2.0 credentials

## 🔧 **Step 1: Deploy to Streamlit Cloud**

1. **Go to [share.streamlit.io](https://share.streamlit.io)**
2. **Sign in with GitHub**
3. **Click "New app"**
4. **Fill in the details:**
   - **Repository**: `Rhino-byte/Hotel-management-system`
   - **Branch**: `main`
   - **Main file path**: `app.py`
   - **App URL**: `hotel-management-system` (or your preferred name)

5. **Click "Deploy"**

## 🔑 **Step 2: Configure Google Sheets API Credentials**

### **Option A: Service Account (Recommended)**

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Navigate to "APIs & Services" > "Credentials"**
3. **Click "Create Credentials" > "Service Account"**
4. **Fill in service account details:**
   - **Name**: `hotel-management-system`
   - **Description**: `Service account for hotel management app`
5. **Click "Create and Continue"**
6. **Skip role assignment, click "Continue"**
7. **Click "Done"**

8. **Click on your new service account**
9. **Go to "Keys" tab**
10. **Click "Add Key" > "Create new key"**
11. **Choose "JSON" format**
12. **Download the JSON file**

### **Option B: OAuth 2.0 Client ID**

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**
2. **Navigate to "APIs & Services" > "Credentials"**
3. **Click "Create Credentials" > "OAuth 2.0 Client ID"**
4. **Choose "Web application"**
5. **Add authorized redirect URIs:**
   ```
   https://your-app-name.streamlit.app
   ```
6. **Download the JSON file**

## ⚙️ **Step 3: Configure Streamlit Secrets**

### **For Service Account:**

1. **Open your downloaded JSON file**
2. **Copy the entire content**
3. **In Streamlit Cloud, go to your app settings**
4. **Click "Secrets"**
5. **Replace the content with your actual service account JSON:**

```toml
[gcp_service_account]
type = "service_account"
project_id = "your-actual-project-id"
private_key_id = "your-actual-private-key-id"
private_key = "-----BEGIN PRIVATE KEY-----\nYOUR_ACTUAL_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
client_email = "your-service-account@your-project.iam.gserviceaccount.com"
client_id = "your-actual-client-id"
auth_uri = "https://accounts.google.com/o/oauth2/auth"
token_uri = "https://oauth2.googleapis.com/token"
auth_provider_x509_cert_url = "https://www.googleapis.com/oauth2/v1/certs"
client_x509_cert_url = "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
```

### **For OAuth 2.0 Client ID:**

```toml
[oauth2_client]
client_id = "your-actual-oauth-client-id"
client_secret = "your-actual-oauth-client-secret"
redirect_uri = "https://your-app-name.streamlit.app"
```

## 🔗 **Step 4: Share Google Sheets**

### **For Service Account:**
1. **Open your Google Sheet**
2. **Click "Share"**
3. **Add your service account email:**
   ```
   your-service-account@your-project.iam.gserviceaccount.com
   ```
4. **Give "Editor" permissions**
5. **Click "Send"**

### **For OAuth 2.0:**
1. **The app will handle authentication automatically**
2. **Users will be prompted to authorize the app**

## 🧪 **Step 5: Test Your Deployment**

1. **Go to your deployed app URL**
2. **Test the following features:**
   - ✅ Load sales data from Google Sheets
   - ✅ Load price data from Google Sheets
   - ✅ Save sales data to Google Sheets
   - ✅ Save price data to Google Sheets

## 🔧 **Troubleshooting**

### **Error: "No Google Sheets API credentials found"**
- ✅ Check that secrets are properly configured
- ✅ Verify JSON format in Streamlit secrets
- ✅ Ensure Google Sheets API is enabled

### **Error: "Access denied"**
- ✅ Share your Google Sheet with the service account email
- ✅ Check that the service account has "Editor" permissions

### **Error: "Invalid credentials"**
- ✅ Verify the JSON content is correct
- ✅ Check that the service account is active
- ✅ Ensure the project has billing enabled

## 📞 **Support**

If you encounter issues:
1. **Check the Streamlit Cloud logs**
2. **Verify your Google Cloud Console settings**
3. **Ensure all permissions are correctly set**

## 🎉 **Success!**

Once configured, your app will:
- ✅ Work both locally and in production
- ✅ Securely access Google Sheets
- ✅ Handle authentication automatically
- ✅ Support multiple users

Your hotel management system is now ready for production use! 🏨 