import sqlite3
import pandas as pd
import numpy as np
import sys
from datetime import date
import altair as alt

# Altair Settings
alt.renderers.enable('notebook')
alt.themes.enable('opaque')

# Establish Connection
con= sqlite3.connect(r'../archive.db')
cur = con.cursor() 


# Count of tweets by state, zero reason
df = pd.read_sql("""SELECT DISTINCT
                    /*upper case state*/
                    CASE 
                        WHEN  UPPER(state) == 'DC' THEN "DC"
                        WHEN  UPPER(state) == 'MD' THEN "MD"
                        WHEN  UPPER(state) == 'VA' THEN "VA"
                        ELSE "OTH" END AS "State",
                    CASE 
                        WHEN  zero_reason == 'unfound' THEN "Plate Not Found"
                        WHEN  zero_reason == 'paid'   THEN  "No Balance"
                        ELSE "Outstanding Balance" END AS "Tweet Result",
                    COUNT (*) as "Tweet Count"
                    FROM tweets
                    WHERE (number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL
                    GROUP BY 1, 2
                    ORDER BY 1, 2;
                    """, con=con)
print(len(df))

# map sort order to states
sort_order = {"DC":1, "MD":2, "VA":3, "OTH":4}
df['sort_order'] = df['State'].map(sort_order)
df.sort_values(['sort_order', 'Tweet Result'], inplace=True)
# Stacked Bar Chart of data
chart =  alt.Chart(df, title='Tweets Received 7/25/18 - 11/10/18').mark_bar().encode(
                x=alt.X('Tweet Count'),
                y=alt.Y('State', sort=alt.EncodingSortField(field='sort_order', op='values')),
                color=alt.Color('Tweet Result', scale=alt.Scale(range=['#F1E6CD','#228B22', '#A62700']))
            )
chart.save('tweet_stacked_bar.html')