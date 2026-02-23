import re
import base64
import io
import os
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
# Read the HTML file
html_path = 'index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

# Find the base64 image data
pattern = r'<image\s+width="(\d+)"\s+height="(\d+)"\s+transform="([^"]*)"\s+xlink:href="data:image/png;base64,([^"]+)"'
match = re.search(pattern, html_content)

if not match:
    print("Could not find the target image tag. Checking alternative pattern...")
    # Maybe without transform or different order?
    pattern2 = r'data:image/png;base64,([^"]+)'
    match2 = re.search(pattern2, html_content)
    if not match2:
        print("Still no match")
        exit(1)
    b64_data = match2.group(1)
    original_width = 18898
    original_height = 13229
    start_pos = match2.start(1) - len('data:image/png;base64,')
    end_pos = match2.end(1)
else:
    original_width = int(match.group(1))
    original_height = int(match.group(2))
    transform = match.group(3)
    b64_data = match.group(4)
    start_pos = match.start(4) - len('data:image/png;base64,')
    end_pos = match.end(4)

print(f"Found image: {original_width}x{original_height}, base64 length: {len(b64_data)}")

# Decode the image
img_data = base64.b64decode(b64_data)
img = Image.open(io.BytesIO(img_data))
print(f"Decoded image size: {img.size}")

# Resize the image if it's too large
MAX_WIDTH = 2500
if img.width > MAX_WIDTH:
    ratio = MAX_WIDTH / img.width
    new_height = int(img.height * ratio)
    print(f"Resizing to {MAX_WIDTH}x{new_height}")
    img = img.resize((MAX_WIDTH, new_height), Image.Resampling.LANCZOS)
else:
    print("Image is not too large.")
    exit(0)

# Save to a file to keep HTML clean and avoid base64 overhead
output_img_path = 'uploads/heatmap_bg.png'
os.makedirs('uploads', exist_ok=True)
img.save(output_img_path, format='PNG', optimize=True)

# Just replace the base64 data with the relative path to the image
# xlink:href="uploads/heatmap_bg.png"
new_tag = f'uploads/heatmap_bg.png'

new_html_content = html_content[:start_pos] + new_tag + html_content[end_pos:]

# Write back
with open(html_path, 'w', encoding='utf-8') as f:
    f.write(new_html_content)

print("Updated index.html successfully.")
