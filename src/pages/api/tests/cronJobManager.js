import { S3Client, ListObjectsCommand } from '@aws-sdk/client-s3'
import mysql from 'mysql2/promise'

const client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
})

const params = {
    Bucket: 'grapevine-nostr-cache-bucket',
    Prefix: 'recentlyAddedEventsByEventId',
};

const command_s3 = new ListObjectsCommand(params);

const url1 = `https://www.graperank.tech/api/dataManagement/transferEventsToEventsTableFromS3?n=200`
const url2 = `https://www.graperank.tech/api/dataManagement/events/processKind3Events?n=1000`
const url3 = `https://www.graperank.tech/api/dataManagement/users/processKind3Events?n=10`
const url4 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jNode?n=1000`
const url5 = `https://www.graperank.tech/api/dataManagement/users/updateNeo4jFollows?n=1`
const url6 = `https://graperank.tech/api/nostr/listeners/multipleUsers?n=900&kind0EventId=true&kind3EventId&kind10000EventId=true`

const fooFxn = async () => {
    const connection = await mysql.createConnection({
        host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
        port: 3306,
        user: process.env.AWS_MYSQL_USER,
        password: process.env.AWS_MYSQL_PWD,
        database: process.env.AWS_MYSQL_DB,
    });
    try {
        let url = url6

        const data_s3 = await client.send(command_s3);
        console.log(`= data_s3: ${JSON.stringify(data_s3)}`)
    
        let numEvents1 = -1
        if (data_s3.Contents) {
          numEvents1 = data_s3.Contents.length
        }

        const sql2 = ` SELECT * FROM events where kind=3 and flaggedForProcessing=1 `
        const results_sql2 = await connection.query(sql2);
        const aEvents2 = JSON.parse(JSON.stringify(results_sql2[0]))
    
        const sql3 = `SELECT * from users WHERE flaggedForKind3EventProcessing=1;`
        const results_sql3 = await connection.query(sql3);
        const aUsers3= JSON.parse(JSON.stringify(results_sql3[0]))
    
        const sql4 = `SELECT * FROM users where flaggedToUpdateNeo4jNode=1;`
        const results_sql4 = await connection.query(sql4);
        const aUsers4= JSON.parse(JSON.stringify(results_sql4[0]))
    
        const sql5 = `SELECT * FROM users where flaggedToUpdateNeo4jFollows=1 AND flaggedToUpdateNeo4jNode=0;`
        const results_sql5 = await connection.query(sql5);
        const aUsers5= JSON.parse(JSON.stringify(results_sql5[0]))
    
        const sql6 = `SELECT * FROM users WHERE whenLastListened IS NULL;`
        const results_sql6 = await connection.query(sql6);
        const aUsers6= JSON.parse(JSON.stringify(results_sql6[0]))

        const close_result = await connection.end()
        console.log(`closing connection: ${close_result}`)

        if (aUsers5.length > 1) { url = url5 }
        if (aUsers6.length > 900) { url = url6 }
        if (aUsers4.length > 1000) { url = url4 }
        if (aUsers3.length > 10) { url = url3 }
        if (aEvents2.length > 1000) { url = url2 }
        if (numEvents1 > 200) { url = url1 }

        // console.log(`url: ${url}`)
        
        fetch(url)

    } catch (error) {
        console.log(`error: ${error}`)
    }
}

fooFxn()

