#!/usr/bin/env python3
from PIL import Image
import numpy as np

# Load the image
img_path = '/Users/michaellocke/WebstormProjects/Home/public/vfr-api/public/veritak_logo_transparent.png'
img = Image.open(img_path)

print(f"Original image mode: {img.mode}")
print(f"Original image size: {img.size}")
print(f"Has alpha channel: {img.mode in ('RGBA', 'LA')}")

# Convert to RGBA if not already
if img.mode != 'RGBA':
    img = img.convert('RGBA')
    print("Converted to RGBA")

# Get image data as numpy array
data = np.array(img)

# Check for white/near-white pixels and make them transparent
# Assuming white matting is RGB values close to 255,255,255
white_threshold = 240  # Pixels with R,G,B all above this become transparent

# Create mask for white/near-white pixels
white_mask = (data[:,:,0] > white_threshold) & (data[:,:,1] > white_threshold) & (data[:,:,2] > white_threshold)

# Set alpha channel to 0 (transparent) for white pixels
data[white_mask, 3] = 0

# For pixels that are slightly off-white (gray borders), reduce alpha
gray_threshold = 200
gray_mask = ((data[:,:,0] > gray_threshold) & (data[:,:,1] > gray_threshold) & (data[:,:,2] > gray_threshold) & 
             ~white_mask)  # Not already transparent
data[gray_mask, 3] = data[gray_mask, 3] // 2  # Reduce alpha by half

# Create new image from modified data
new_img = Image.fromarray(data, 'RGBA')

# Save the truly transparent version
output_path = '/Users/michaellocke/WebstormProjects/Home/public/vfr-api/public/veritak_logo_truly_transparent.png'
new_img.save(output_path, 'PNG')

print(f"\nSaved truly transparent logo to: {output_path}")
print(f"New image mode: {new_img.mode}")

# Also save to assets folder
assets_output = '/Users/michaellocke/WebstormProjects/Home/public/vfr-api/assets/images/veritak_logo_truly_transparent.png'
new_img.save(assets_output, 'PNG')
print(f"Also saved to: {assets_output}")