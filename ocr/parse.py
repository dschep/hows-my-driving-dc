import pandas as pd
import os
import sqlite3

# Generate Dataframe from Spreadsheets of ocred images
ocr_dir = 'archive_images_ocr'
ocr_list = os.listdir(ocr_dir)

# Load the Violation mapping csv
viol_map_df = pd.read_csv('violation_mapping.csv')
violation_dict = viol_map_df.set_index('ORIGINAL')['NORMALIZED'].to_dict()

stacked_df_list = []
for file_num, ocr_file in enumerate(ocr_list):
    print(file_num, ocr_file)
    df = pd.read_excel(os.path.join(ocr_dir, ocr_file),
                       sheet_name='Table 1',
                       skiprows=1,
                       header=None,
                       usecols='A:E',
                       dtype=str)
    # Split the data into rows
    stacked_series = []
    for col in df.columns:
        reshaped = df[col].str.split('\n', expand=True).stack()
        stacked_series.append(reshaped)

    stacked_df = pd.concat(stacked_series, axis=1)
    stacked_df.reset_index(drop=True, inplace=True)
    # Break if there arent' any observations (ie len ==1)
    if len(stacked_df) == 1:
        continue
    # Name the columns
    stacked_df.columns = ['Ticket Number',
                          'Issue Date',
                          'Violation',
                          'Location',
                          'Amount']

    # Drop the first row
    stacked_df.drop([0], inplace=True)

    # Strip out spaces from Ticket Number and Issue Date Violation and Amount
    stacked_df['Ticket Number'] = stacked_df['Ticket Number'].str.replace(' ', '')
    stacked_df['Ticket Number'] = stacked_df['Ticket Number'].str.replace('""', '**')
    stacked_df['Ticket Number'] = stacked_df['Ticket Number'].str.replace("'", '')

    # strip out leading and ending white speace
    stacked_df['Violation'] = stacked_df['Violation'].str.strip()

    # Add TweetID as field
    stacked_df['TweetID'] = ocr_file.split(".")[0]

    stacked_df_list.append(stacked_df)

# Concat the stacked dfs
final_df = pd.concat(stacked_df_list, axis=0)
# Convert Issue date to Date Time
final_df['Issue Date'] = final_df['Issue Date'].str.replace(' ', '')
final_df['Issue Date'] = final_df['Issue Date'].str.replace('00:00:00', '')
final_df['Issue Date'] = pd.to_datetime(final_df['Issue Date'])
# Normalize Violations
final_df['Violation'] = final_df['Violation'].map(violation_dict)
# Clean up the amount field
final_df['Amount'] = final_df['Amount'].str.replace(' ', '')
final_df['Amount'] = final_df['Amount'].str.replace('$', '').astype(float)
final_df['Amount'] = final_df['Amount'].astype(int)
final_df.columns = ['ticket',
                    'issue_date',
                    'violation',
                    'location',
                    'amount',
                    'tweetid']

# Connect to DB
con = sqlite3.connect(r'../archive.db')
cur = con.cursor()

# Load final_df to ticket table
final_df.to_sql('tickets',
                con=con,
                if_exists='replace',
                index=False)
