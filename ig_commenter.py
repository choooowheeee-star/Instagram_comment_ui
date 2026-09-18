import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

# Path set to the same folder (looks for comments.txt right next to this script)
file_path = "comments.txt"

try:
  with open(file_path, "r", encoding="utf-8") as file:
    comments = [line.strip() for line in file if line.strip()][:500]
  print(f"Successfully loaded {len(comments)} comments from local folder.")
except FileNotFoundError:
  print(
      f"Error: Could not find '{file_path}' in the current folder. Make sure it"
      " is uploaded to your GitHub repository."
  )
  exit()

# Setup Mobile Chrome options
options = webdriver.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

driver = webdriver.Chrome(options=options)
wait = WebDriverWait(driver, 15)

try:
  # Open Instagram mobile site
  driver.get("https://www.instagram.com/accounts/login/")
  print("\nLog into your Instagram account manually in the browser window.")
  input("Once logged in and sitting on the post page, press Enter here...")

  for index, comment in enumerate(comments, start=1):
    try:
      # Locate comment box on mobile web layout
      comment_box = wait.until(
          EC.presence_of_element_located(
              (By.XPATH, '//textarea[@placeholder="Add a comment…"]')
          )
      )
      comment_box.click()
      comment_box.send_keys(comment)
      time.sleep(1)

      # Locate post button
      post_button = wait.until(
          EC.element_to_be_clickable(
              (By.XPATH, '//div[text()="Post" or text()="Publish"]')
          )
      )
      post_button.click()

      print(f"[{index}/{len(comments)}] Posted: {comment}")

      # CRITICAL: Wait 20-30 seconds between comments to avoid blocks
      time.sleep(25)

    except Exception as e:
      print(f"[{index}] Error posting comment: {e}")
      time.sleep(15)

finally:
  print("Script finished.")
  driver.quit()
  
