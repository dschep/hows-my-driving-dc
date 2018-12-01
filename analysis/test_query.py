import sqlite3
import pandas as pd
import altair as alt
from datetime import date

alt.renderers.enable('notebook')
alt.themes.enable('opaque')
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

df = pd.read_sql("""SELECT 
                    MIN(date(created_at)) as start_date,
                    MAX(date(created_at)) as end_date,
                    COUNT(*) as total_tweets,
                    COUNT(CASE WHEN amount > 0 THEN tweet_id ELSE NULL END) as tweets_w_value,
                    COUNT(CASE WHEN state is NULL THEN tweet_id ELSE NULL END) as invalid_tweets,
                    SUM(amount) as total_citation_value,
                    COUNT(DISTINCT user) as unique_twitter_users,
                    COUNT(DISTINCT state||number) as unique_plates
                    FROM tweets
                    WHERE (number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL;
                    """, con=con)
print(df)

# % of repeat users
df = pd.read_sql("""with tweets_per_user AS (SELECT 
                                             user,
                                             COUNT(*) as tweets
                                             FROM tweets
                                             GROUP BY 1
                                             ORDER BY 2 DESC)
                    SELECT 
                    COUNT(DISTINCT CASE WHEN tweets > 1 THEN user ELSE NULL END) AS repeat_users,
                    COUNT(*) as total_users,
                    1.0*COUNT(DISTINCT CASE WHEN tweets > 1 THEN user ELSE NULL END) / COUNT(*) as perc_repeat_users
                    FROM tweets_per_user
                    """, con=con)
print(df)

# % of repeat plates
df = pd.read_sql("""with tweets_per_plate AS (SELECT 
                                             state||number as plate,
                                             COUNT(*) as tweets
                                             FROM tweets
                                             GROUP BY 1
                                             ORDER BY 2 DESC)
                    SELECT 
                    COUNT(DISTINCT CASE WHEN tweets > 1 THEN plate ELSE NULL END) AS repeat_plates,
                    COUNT(*) as total_plates,
                    sum(tweets) as total_tweets,
                    1.0*COUNT(DISTINCT CASE WHEN tweets > 1 THEN plate ELSE NULL END) / COUNT(*) as perc_repeat_plates
                    FROM tweets_per_plate
                    """, con=con)
print(df)

# Total Tweets and Citation Value by State
dmv_df = pd.read_sql("""SELECT
                    UPPER(state) AS state,
                    COUNT(*) AS total_tweets,
                    SUM(amount) AS total_citation_value
                    FROM tweets
                    WHERE state IS NOT NULL
                    GROUP by 1
                    ORDER by 3 DESC
                    LIMIT 3;
                    """, con=con)
print(dmv_df)

dmv_df = pd.read_sql("""SELECT
                    COUNT(*) AS total_tweets,
                    SUM(amount) AS total_citation_value
                    FROM tweets
                    WHERE state IS NOT NULL
                    ;
                    """, con=con)
print(dmv_df)

# Users
user_df = pd.read_sql("""SELECT
                    user,
                    COUNT(*) AS total_tweets,
                    SUM(amount) AS total_citation_value
                    FROM tweets
                    WHERE (state IS NOT NULL)
                    AND ((number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL)
                    GROUP by 1
                    ORDER by 3 DESC
                    LIMIT 13;
                    """, con=con)
user_df.to_csv("output/top_users.csv")


# Tweets per day
daily_df = pd.read_sql("""SELECT 
                    DATE(created_at) as date,
                    COUNT(*) as "Count of Tweets per Day"
                    FROM tweets
                    GROUP by 1
                    """, con=con)
# Convert date to datetime
daily_df['date'] = pd.to_datetime(daily_df['date'])

# Merge on day of WaPo Article
dates = [date(2018,9,20), date(2018, 10, 31)]
events = [' WaPo article published',
          ' ABC 7 story aired']

# Define Dataframe of Mobike Events
events_df = pd.DataFrame({'date': dates, 'event': events})
events_df['date'] = pd.to_datetime(events_df['date'])

# Merge on Dataframe of Mobike Events
daily_df = daily_df.merge(events_df, on=['date'], how='left')

daily_chart = alt.Chart(daily_df).mark_line(opacity=0.8).encode(
            alt.X('date', title=" "),
            alt.Y('Count of Tweets per Day')
            )

# Annonated point
points = alt.Chart(daily_df[~daily_df['event'].isnull()]
             ).mark_point(color='red'                
             ).encode(
             alt.X('date', title=" "),
             alt.Y('Count of Tweets per Day')
)

# Annotated text
text = points.mark_text(
                  align='left',
                  baseline='bottom',
        ).encode(
            text='event',
        )

combined_chart = daily_chart + points  + text
combined_chart.save('daily_tweet_count.html')


