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

'''
 the name of the table is tweets
 here are the columns
[(0, 'tweet_id', 'text', 0, None, 0), 
    (1, 'created_at', 'timestamp', 0, None, 0), 
    (2, 'content', 'text', 0, None, 0), 
    (3, 'state', 'varchar(2)', 0, None, 0), 
    (4, 'number', 'text', 0, None, 0), 
    (5, 'amount', 'double', 0, None, 0), 
    (6, 'user', 'text', 0, None, 0), 
    (7, 'summoning_text', 'text', 0, None, 0), the complete tweet, DNU
    (8, 'zero_reason', 'text', 0, None, 0)], reason why return was zero, either not paid or unfound, is null if amount has value
'''

''' Count of total tweets, 
    Tweets that were hits, 
    total value, 
    unique tweeter users,
    unique license plates,
'''
# Pull All Tweets with a Value
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
print(dmv_df[['age', 'state', 'amount']].groupby('state').mean())
print(dmv_df[['age', 'state', 'amount']].groupby('state').max())

# plot age and amount
fig, axes = plt.subplots(ncols=1, nrows=1) 

# age
age_df = dmv_df[dmv_df['age'] <=1000]
sns.distplot(age_df[age_df['state'] == 'DC']['age'],  
             ax = axes,
             axlabel = False,
             hist=False,             
             label="DC", 
             color='red')  
sns.distplot(age_df[age_df['state'] == 'MD']['age'],  
             ax = axes,
             axlabel = False,
             hist=False,             
             label="MD", 
             color='black')  
sns.distplot(age_df[age_df['state'] == 'VA']['age'],  
             ax = axes,
             axlabel = False,
             hist=False,             
             label="VA", 
             color='blue')  
# Now force y axis extent to be correct
axes.autoscale()
plt.savefig("age.png",bbox_inches='tight',dpi=100)

# Amount
fig, axes = plt.subplots(ncols=1, nrows=1) 
amount_df = dmv_df[dmv_df['amount'] <=600]
sns.distplot(amount_df[amount_df['state'] == 'DC']['amount'],  
             ax = axes,
             axlabel = False,
             hist=False,             
             label="DC", 
             color='red')  
sns.distplot(amount_df[amount_df['state'] == 'MD']['amount'],  
             ax = axes,
             axlabel = False,
             hist=False,             
             label="MD", 
             color='black')  
sns.distplot(amount_df[amount_df['state'] == 'VA']['amount'],  
             ax = axes,
             axlabel = False,
             hist=False,             
             label="VA", 
             color='blue')  
# Now force y axis extent to be correct
axes.autoscale()

plt.savefig("amount.png",bbox_inches='tight',dpi=100)
