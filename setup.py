#!/usr/bin/env python3
"""
Setup script for Hotel Management System
"""

import subprocess
import sys
import os

def install_requirements():
    """Install required packages"""
    print("📦 Installing required packages...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("✅ All packages installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error installing packages: {e}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    if sys.version_info < (3, 7):
        print("❌ Python 3.7 or higher is required")
        return False
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    return True

def create_sample_credentials():
    """Create a sample credentials.json template"""
    sample_credentials = {
        "installed": {
            "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
            "project_id": "your-project-id",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_secret": "YOUR_CLIENT_SECRET",
            "redirect_uris": ["http://localhost"]
        }
    }
    
    if not os.path.exists("credentials.json"):
        import json
        with open("credentials.json", "w") as f:
            json.dump(sample_credentials, f, indent=2)
        print("📝 Created sample credentials.json template")
        print("⚠️  Please replace with your actual Google Sheets API credentials")
    else:
        print("✅ credentials.json already exists")

def main():
    """Main setup function"""
    print("🏨 Hotel Management System Setup")
    print("=" * 40)
    
    # Check Python version
    if not check_python_version():
        sys.exit(1)
    
    # Install requirements
    if not install_requirements():
        sys.exit(1)
    
    # Create sample credentials
    create_sample_credentials()
    
    print("\n🎉 Setup completed!")
    print("\nNext steps:")
    print("1. Replace credentials.json with your actual Google Sheets API credentials")
    print("2. Create a Google Sheet with the required headers")
    print("3. Run: streamlit run app.py")
    print("\nFor detailed instructions, see README.md")

if __name__ == "__main__":
    main() 