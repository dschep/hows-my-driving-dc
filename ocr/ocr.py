# import the necessary packages
from PIL import Image
import pytesseract
import argparse
import cv2
import os
import sys
import pandas as pd

def read_image(args):
    '''
    loads the image to memory
    '''
    return  cv2.imread(args["image"])


def extract_text(image):
    '''
    Extracts text from the image
    '''
    return pytesseract.image_to_string(image)

#Parse Columns
def string_to_df(text, column_names):
    '''
    converts columns from the string representation of the DMV Output images
    to one-column dataframe
    '''
    df_columns = []
    for col_num, column_name in enumerate(column_names):
        # Parition initally based on column name
        init_part = text.partition(column_name)[2]
        # Partition again based on next column name
        if column_name != column_names[-1]:
            final_part =init_part.partition(column_names[col_num + 1])[0]
        else:
            final_part = init_part
        # replace double line break with link break
        final_part = final_part.replace('\n\n', '\n')
        # split lines, not keeping the first item in list
        text_list = final_part.splitlines()[1:]
        # convert list to dataframe and append to df list
        df = pd.DataFrame(text_list, columns=[column_name])
        df_columns.append(df)
    combined_df = pd.concat(df_columns, axis=1)
    return combined_df

def main():
    # Construct the argument parse and parse the arguments
    ap = argparse.ArgumentParser()
    ap.add_argument("-i", "--image", required=True,
        help="path to input image to be OCR'd")
    args = vars(ap.parse_args())
    # Read in Image
    image = read_image(args=args)
    # Extract Text from Image
    text = extract_text(image=image)
    # Parse Text string into dataframe
    column_names = ['ket Number',
                    'sue Date',
                    'iolation',
                    'Location',
                    'Amount']

    df = string_to_df(text=text,
                      column_names=column_names)
    print(df)


if __name__ == '__main__':
    main()



