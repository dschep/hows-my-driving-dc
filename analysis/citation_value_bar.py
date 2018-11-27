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
df = pd.read_sql("""SELECT
                    /*upper case state*/
                    CASE 
                        WHEN  UPPER(state) == 'DC' THEN "DC"
                        WHEN  UPPER(state) == 'MD' THEN "MD"
                        WHEN  UPPER(state) == 'VA' THEN "VA"
                        ELSE "OTH" END AS "State",
                    UPPER(state) as state,
                    number,
                    amount
                    FROM tweets
                    WHERE amount > 0 
                    AND  ((number NOT IN ('NOTAGS', 'notag', 'na')) OR
                          number is NULL);
                    """, con=con)

# drop duplicates by state and number
df.drop_duplicates(['state', 'number'], inplace=True)

# map sort order to states
sort_order = {"DC":1, "MD":2, "VA":3, "OTH":4}
df['sort_order'] = df['State'].map(sort_order)
df.sort_values(['sort_order'], inplace=True)
print(df.tail())

# Stacked Bar Chart of data
chart =  alt.Chart(df, title='Total Citation Value by State').mark_bar().encode(
                x=alt.X('sum(amount)', title = 'Citation Value ($)'),
                y=alt.Y('State', sort=alt.EncodingSortField(field='amount', order='descending', op='sum'))
            )
chart.save('citation_value_bar.html')