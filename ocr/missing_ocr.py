import os

'''
There are 10 jpgs that were not converted to through Adobe to Excel because damaged
This script IDs those JPEGS
'''

image_dir = 'archive_images'
image_list = [f.split(".")[0] for f in os.listdir(image_dir)]
ocr_dir = 'archive_images_ocr'
ocr_list = [f.split(".")[0] for f in os.listdir(ocr_dir)]

non_ocr_list = [x for x in image_list if x not in ocr_list]
print(non_ocr_list)
