import type { NextApiRequest, NextApiResponse } from 'next'

/*
Use this endpoint to verify that the server is up

Usage:

https://grapeRank.tech/api
*/

type ResponseData = {
  message: string,
  success: boolean,
}
 
export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  res.status(200).json({ message: `api Hello from Next.js!`, success: true })
}

/*
sequence:

delete s3 data

https://www.graperank.tech/api/sql/deleteTables

https://www.graperank.tech/api/sql/initializeTables

for each customer:
https://graperank.tech/api/nostr/listeners/singleUser?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

trigger all of these repeatedly:

cronJob1.js
https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=200
s3:
(relatively fast; n=100 took 13 secs; n=200 took 28 secs)

cronJob2.js
https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1000
sql: SELECT * FROM events where kind=3 and flaggedForProcessing=1;
(super fast, should be able to do a lot at once; n=200 took under 3 seconds; n=1000 took about 12 seconds)

cronJob3.js
https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=10
sql: SELECT * from users WHERE flaggedForKind3EventProcessing=1;
(slow; n=10 took maybe 30-45 sec ??? )

cronJob4.js
https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1000
sql: SELECT * FROM users where flaggedToUpdateNeo4jNode=1;
(very fast; n=1000 took less than 20 seconds)

cronJob5.js
DEPRECATED: https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollows?n=1
(ver slow; n=1 took 15 seconds; n=5 timed out at 60 seconds)
https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsByCsv?n=100
(fast: n=200 takes 30 seconds)
sql: SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0;

Going to replace cronJob5 with this endpoint:
https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollowsByCsv?n=1

cronJob6.js
// OLD: https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind0EventId=true&kind3EventId&kind10000EventId=true
https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind3EventId=true
SELECT * FROM users [WHERE (kind0EventId IS NULL) OR (kind3EventId IS NULL) OR (kind10000EventId IS NULL)] ORDER BY whenLastListened ASC LIMIT ;
(fast; n=100 took 10 secs; n=900 less than 20 seconds)

CRON JOBS:
pm2 start cronJob1.js --cron "0,10,20,30,40,50 * * * *"
pm2 start cronJob2.js --cron "1,11,21,31,41,51 * * * *"
pm2 start cronJob3.js --cron "2,12,22,32,42,52 * * * *"
pm2 start cronJob4.js --cron "3,13,23,33,43,53 * * * *"
pm2 start cronJob5.js --cron "4,14,24,34,44,54 * * * *"
pm2 start cronJob6.js --cron "5,15,25,35,45,55 * * * *"

pm2 start cronJobManager.js --cron "* * * * *"

pm2 start cronJobBackgroundListener.js --cron "* * * * *"

pm2 list

pm2 delete cronJob1

https://www.graperank.tech/api/neo4j/getNostrUsers

When restarting the server, make sure to:

1. restart graperank (do this from folder: graperank)
pm2 start npm --name "graperank" -- start

2. restart cronJobManager (do this from /home/ubuntu/graperank/src/cronJobs)
pm2 start cronJobManager.js --cron "* * * * *"

3. restart cronJobBackgroundListener (do this from /home/ubuntu/graperank/src/cronJobs)
// pm2 start cronJobBackgroundListener.js
I want this to keep the connection open, but if it does not, then put it as a cron job, something like this (q 30 minutes):
pm2 start cronJobBackgroundListener.js --cron "15,45 * * * *"

4. restart neo4j USING SUDO (otherwise brainstorm database will not be available)
sudo neo4j start

check if memory is filling up:
df -h
need to do java garbage collection ???
*/
