import sqlite3
import pandas as pd
import numpy as np
import sys
from datetime import date
import altair as alt
import seaborn as sns
import matplotlib.pyplot as plt

# Altair Settings
alt.renderers.enable('notebook')
alt.themes.enable('opaque')

# Seaborn Settings
sns.set(style="whitegrid")

# Establish Connection
con= sqlite3.connect(r'../archive.db')
cur = con.cursor() 

''' Count of total tweets, 
    Tweets that were hits, 
    total value, 
    unique tweeter users,
    unique license plates,
'''
# Pull the entire tweet database
df = pd.read_sql("""SELECT
                    tweet_id,
                    CASE 
                        WHEN  UPPER(state) == 'DC' THEN "DC"
                        WHEN  UPPER(state) == 'MD' THEN "MD"
                        WHEN  UPPER(state) == 'VA' THEN "VA"
                        ELSE "OTH" END AS state_agg,
                    UPPER(state) as state,
                    number,
                    created_at
                    FROM tweets
                    /* remove hack license plates*/
                    WHERE (number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL;
                    """, con=con) 
# Pull All Tickets
ticket_df = pd.read_sql("""SELECT 
                           * 
                           FROM tickets
                           ;
                        """, con=con)
                         

# Keep unique license plates
unique_df = df.drop_duplicates(['state', 'number'])


# Merge Total Tickets associated with Unique licenses
ticket_df = ticket_df.merge(unique_df[['tweet_id', 'state_agg', 'number', 'created_at']], 
                           left_on='tweetid', 
                           right_on='tweet_id', 
                           how='inner')


# Convert date fields to date
ticket_df['created_at'] = pd.to_datetime(ticket_df['created_at'])
ticket_df['issue_date'] = pd.to_datetime(ticket_df['issue_date'])

# Calculate Ticket Age
ticket_df['citation age (years)'] = (ticket_df['created_at'].dt.date - ticket_df['issue_date'].dt.date) / np.timedelta64(1, 'Y')  

# Max Ticket Age by State
print(ticket_df[['state_agg', 'citation age (years)']].groupby('state_agg').max())
print(ticket_df[['state_agg', 'citation age (years)']].groupby('state_agg').median() * 12)

# plot age as box
fig, axes = plt.subplots(figsize=(15, 5),ncols=1, nrows=1) 
# Make a dictionary with one specific color per group:
my_pal = {"DC": sns.xkcd_rgb["pale red"], 
          "MD": sns.xkcd_rgb["amber"], 
          "VA": sns.xkcd_rgb['windows blue'], 
          "OTH": sns.xkcd_rgb["dusty purple"]}

axes = sns.violinplot(x="citation age (years)", 
                      y="state_agg", 
                      data=ticket_df,
                      order =['DC', 'MD', 'VA', 'OTH'],
                      palette=my_pal)
axes = sns.stripplot(x="citation age (years)", 
                     y="state_agg", 
                     data=ticket_df,
                     order =['DC', 'MD', 'VA', 'OTH'],
                     jitter=True,
                     linewidth=1,
                     palette=my_pal)
# high y axis label
axes.set_ylabel('') 
axes.autoscale()
plt.savefig("output/age_violin.png",bbox_inches='tight',dpi=100)
sys.exit()
