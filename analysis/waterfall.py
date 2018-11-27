import sqlite3
import pandas as pd
import numpy as np
import sys
from datetime import date

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
# Pull the entire tweet database
df = pd.read_sql("""SELECT 
                    * 
                    FROM tweets
                    /* remove hack license plates*/
                    WHERE (number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL;
                    """, con=con)
# 
# Pull All Tickets
ticket_df = pd.read_sql("""SELECT 
                           * 
                           FROM tickets
                           ;
                        """, con=con)
# Uppercase state                    
df['state'] = df['state'].str.upper()
df['state_agg'] = np.where(df['state'].isin(['DC','VA', 'MD']), df['state'], 'OTHER')
                         

# 1) Total Tweets by State, Other 
total_tweets = pd.pivot_table(df[['amount', 'state_agg']], 
                              index=['state_agg'], 
                              aggfunc='count',
                              margins=True).transpose()
total_tweets.index = ['Total Tweets']

# 2) Total Tweets with Positive Balance
balance_df = df[df['amount'] > 0]
tweets_balance = pd.pivot_table(balance_df[['amount', 'state_agg']], 
                                index=['state_agg'], 
                                aggfunc='count',
                                margins=True).transpose()
tweets_balance.index = ['Tweets w/ Balance']

# 3) Unique licenses, total citiation values
unique_df = balance_df.drop_duplicates(['state', 'number'])
licenses = pd.pivot_table(unique_df[['amount', 'state_agg']], 
                                index=['state_agg'],
                                values= ['amount'], 
                                aggfunc= [len, np.sum],
                                margins=True).transpose()
licenses.index = ['Unique Licenses w/ Balance', 'Citation Balance']

#4) Total Tickets associated with Unique licenses
ticket_df = ticket_df.merge(unique_df[['tweet_id', 'state_agg', 'number', 'created_at']], 
                           left_on='tweetid', 
                           right_on='tweet_id', 
                           how='inner')
# Convert date fields to date
ticket_df['created_at'] = pd.to_datetime(ticket_df['created_at'])
ticket_df['issue_date'] = pd.to_datetime(ticket_df['issue_date'])
# Calculate Ticket Age
ticket_df['age'] = (ticket_df['created_at'].dt.date - ticket_df['issue_date'].dt.date) / np.timedelta64(1, 'D')  

tickets = pd.pivot_table(ticket_df[['state_agg', 'age']], 
                         index=['state_agg'],
                         values= ['age'], 
                         aggfunc= [len, np.mean, np.max],
                         margins=True).transpose()
tickets.index = ['Citations', 
                 'Citation Age (days) - Avg', 
                 'Citation Age (days) - Max']

# Combine all dataframe
final_df = pd.concat([total_tweets,
                      tweets_balance,
                      licenses,
                      tickets],axis=0)

final_df.to_csv('waterfall.csv')


