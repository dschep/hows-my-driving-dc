import sqlite3
import pandas as pd
from datetime import date
import numpy as np
import seaborn as sns
import matplotlib.pyplot as plt


sns.set_style("darkgrid")
# Establish Connection
con= sqlite3.connect(r'../archive.db')
cur = con.cursor() 

# Pull All Tweets with a Value and not N/A or Notags
tweet_df = pd.read_sql("""SELECT 
                           * 
                          FROM tweets
                          WHERE amount > 0 
                          AND  ((number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL)
                          ORDER BY created_at;
                        """, con=con)
# Pull All Tickets
ticket_df = pd.read_sql("""SELECT 
                           * 
                           FROM tickets
                           ;
                        """, con=con)

# De-dup tweets df by license plate (ie state and number)
tweet_df.drop_duplicates(['state', 'number'], inplace=True) # 68 of 460 dropped for duplicates

# Keep only those tickets associted with a de-duped tweet
dedup_df = ticket_df.merge(tweet_df[['tweet_id', 'state', 'number', 'created_at']], 
                           left_on='tweetid', 
                           right_on='tweet_id', 
                           how='inner')
# Convert date fields to date
dedup_df['created_at'] = pd.to_datetime(dedup_df['created_at'])
dedup_df['issue_date'] = pd.to_datetime(dedup_df['issue_date'])
# Calculate ticket_age
dedup_df['age'] = (dedup_df['created_at'].dt.date - dedup_df['issue_date'].dt.date) / np.timedelta64(1, 'D')  
# Uppercase State field
dedup_df['state'] = dedup_df['state'].str.upper()
# Remove tickets being adjudicated
dedup_df = dedup_df[~dedup_df['ticket'].str.contains("*", regex=False)]
# 153 ticket are being adjudicated
# Keep only DMV  
dmv_df = dedup_df[dedup_df['state'].isin(['DC', 'MD', 'VA'])]
# Average age and amount
for state in dmv_df['state'].drop_duplicates().tolist():
    print(state)
    state_df = dmv_df[dmv_df['state'] == state] 
    print((state_df['violation'].value_counts().head(10)) / len(state_df) )

