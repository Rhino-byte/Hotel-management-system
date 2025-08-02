# 🔐 Google Sheets API Setup Guide

## **Step 1: Create Google Cloud Project**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top
3. Click "New Project"
4. Name it "Hotel Management System" (or any name you prefer)
5. Click "Create"

## **Step 2: Enable Google Sheets API**

1. In the left sidebar, go to **"APIs & Services" > "Library"**
2. Search for **"Google Sheets API"**
3. Click on it
4. Click **"Enable"** button

## **Step 3: Create OAuth 2.0 Credentials**

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"Create Credentials"** at the top
3. Select **"OAuth 2.0 Client IDs"**
4. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: "Hotel Management System"
   - User support email: Your email
   - Developer contact information: Your email
   - Save and continue through the steps
5. Back to creating credentials:
   - Application type: **Desktop application**
   - Name: "Hotel Management System"
   - Click **"Create"**

## **Step 4: Download Credentials**

1. After creating, you'll see a download button (JSON icon)
2. Click **"Download JSON"**
3. Rename the downloaded file to `credentials.json`
4. Move it to your project folder (same folder as `app.py`)

## **Step 5: Create Google Sheet**

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet
3. Name it "Hotel Sales Data"
4. In the first row (A1:G1), add these headers:
   ```
   Date | Item | Quantity | Price | Total | Category | Notes
   ```
5. Copy the Spreadsheet ID from the URL:
   - URL looks like: `https://docs.google.com/spreadsheets/d/1ABC123.../edit`
   - Copy the part between `/d/` and `/edit` (the long string)

## **Step 6: Configure the App**

1. Run the app: `streamlit run app.py`
2. In the sidebar, paste your Spreadsheet ID
3. Set sheet name to "Sheet1" (or whatever you named your sheet)
4. Click "Load Data from Google Sheets"
5. Follow the authentication flow in your browser

## **Alternative: Quick Test Without Google Sheets**

If you want to test the app first without Google Sheets:

1. Comment out the Google Sheets code in `app.py`
2. The app will work with local storage only
3. You can export data as CSV

## **Troubleshooting 401 Error**

**Common causes:**
- Using sample credentials instead of real ones
- Wrong Spreadsheet ID
- Sheet not shared with your Google account
- API not enabled

**Solutions:**
1. Make sure you downloaded real credentials from Google Cloud Console
2. Verify the Spreadsheet ID is correct
3. Share your Google Sheet with your email address
4. Check that Google Sheets API is enabled in your project

## **File Structure After Setup**

```
your-project/
├── app.py
├── requirements.txt
├── credentials.json  ← Your real credentials here
├── token.pickle      ← Created automatically after auth
└── README.md
```

## **Need Help?**

If you're still getting errors:
1. Check the console output for specific error messages
2. Make sure all files are in the same folder
3. Verify your Google Cloud project has billing enabled (if required)
4. Try the authentication flow again by deleting `token.pickle` 