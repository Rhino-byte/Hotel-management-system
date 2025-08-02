# Simple R test script
cat("Testing R installation...\n")

# Check if required packages are available
required_packages <- c("shiny", "shinydashboard", "DT", "dplyr", "lubridate")

cat("Checking required packages:\n")
for (pkg in required_packages) {
  if (require(pkg, character.only = TRUE)) {
    cat(paste("✓", pkg, "is available\n"))
  } else {
    cat(paste("✗", pkg, "needs to be installed\n"))
  }
}

cat("\nR is working! You can now run the main app.\n")
cat("To run the app, use: source('app.R')\n") 