 <img width="240" height="240" alt="image" src="https://github.com/user-attachments/assets/e89692d0-5b0a-4e92-9436-ba5a6d1e2af7" />
 
 # Hotel Management System

A comprehensive hotel management system built with Streamlit and Google Sheets integration for sales tracking, analytics, and price management.

## 🚀 **Deployment Instructions**

### **Option 1: Streamlit Cloud (Recommended)**

1. **Push to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

2. **Deploy on Streamlit Cloud:**
   - Go to [share.streamlit.io](https://share.streamlit.io)
   - Sign in with GitHub
   - Click "New app"
   - Select your repository
   - Set main file path: `app.py`
   - Click "Deploy"
<img width="927" height="323" alt="image" src="https://github.com/user-attachments/assets/b54ba467-abb7-4281-9442-980a9037170c" />

### **Option 2: Heroku**

1. **Create Procfile:**
   ```
   web: streamlit run app.py --server.port=$PORT --server.address=0.0.0.0
   ```

2. **Deploy:**
   ```bash
   heroku create your-app-name
   git push heroku main
   ```

### **Option 3: Railway**

1. **Create railway.toml:**
   ```toml
   [build]
   builder = "nixpacks"

   [deploy]
   startCommand = "streamlit run app.py --server.port=$PORT --server.address=0.0.0.0"
   ```

2. **Deploy via Railway dashboard**

## 📋 **Features**

- **📝 Sales Data Entry**: Bulk entry system for daily sales
- **📋 Current Sales**: View and filter sales data
- **📊 Analytics**: Date-filtered analytics with charts
- **💰 Price Management**: Password-protected price editing
- **🔗 Google Sheets Integration**: Real-time data sync

## ⚙️ **Setup**

### **Local Development:**
```bash
pip install -r requirements.txt
streamlit run app.py
```

### **Google Sheets Setup:**
1. Create Google Cloud Project
2. Enable Google Sheets API
3. Create OAuth 2.0 credentials
4. Download `credentials.json`
5. Place in project root

## 🔐 **Security**
- Price editing password: `bushman`
- Google Sheets authentication required

## 📁 **File Structure**
```
├── app.py                 # Main application
├── requirements.txt       # Python dependencies
├── credentials.json       # Google API credentials
├── .streamlit/config.toml # Streamlit configuration
└── README.md             # This file
```

## 🌐 **Access**
- **Local**: http://localhost:8501
- **Deployed**: Your deployment URL 
