import sqlite3
import pandas as pd
import altair as alt
from datetime import date

# Establish Connection
con= sqlite3.connect(r'../archive.db')
cur = con.cursor() 

# Max Date
df = pd.read_sql("""SELECT 
                    MAX(date(created_at)) as end_date
                    FROM tweets
                    WHERE (number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL;
                    """, con=con)
print(df['end_date'].values[0])

# Users
user_df = pd.read_sql("""SELECT
                    user,
                    COUNT(*) AS total_tweets
                    FROM tweets
                    WHERE (state IS NOT NULL)
                    AND ((number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL)
                    AND user NOT IN ('schep_', 'msussmania', 'HowsMyDrivingDC')
                    GROUP by 1
                    ORDER by 2 DESC
                    LIMIT 25;
                    """, con=con)
user_df.to_csv("output/top_25_users_as_of_{}.csv".format(df['end_date'].values[0]))

