import type { NextApiRequest, NextApiResponse } from 'next'
import mysql from 'mysql2/promise'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { PubkeysBySqlId, ResponseData } from '@/types'
// import { arrayToObject } from '@/helpers';

/*
usage:
https://www.graperank.tech/api/dataManagement/users/addPubkeysBySqlIdLookupToS3

returns an object used to fetch a user pubkey given the userID from the table: users

Useful since several tables, including ratingsTables and scorecardsTables, use userID rather than pubkey to refer to users 
*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    const connection = await mysql.createConnection({
      host: 'grapevine-nostr-cache-db.cp4a4040m8c9.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: process.env.AWS_MYSQL_USER,
      password: process.env.AWS_MYSQL_PWD,
      database: process.env.AWS_MYSQL_DB,
    });
    const command1 = `SELECT id, pubkey FROM users; `
    const results1 = await connection.query(command1);
    const aResults1 = JSON.parse(JSON.stringify(results1[0]))
  
    const close_result = await connection.end()
    console.log(`closing connection: ${close_result}`)
    const oPubkeysBySqlId:PubkeysBySqlId = {}
    // TODO: initialize oPubkeysBySqlId with preexisting file, if present, and only query table for recent users
    for (let x=0; x < aResults1.length; x++) {
      const oNextUser = aResults1[x]
      const id = Number(oNextUser.id)
      const pk = oNextUser.pubkey
      oPubkeysBySqlId[id] = pk
    }

    const resultUsersChars = JSON.stringify(aResults1).length
    const megabyteSize = resultUsersChars / 1048576

    /* PutObjectCommand */
    const fooFxn = async (oPubkeysBySqlId:PubkeysBySqlId) => {
      const sOutput = JSON.stringify(oPubkeysBySqlId)
      return sOutput
    }

    const params_put = {
      Bucket: 'grapevine-nostr-cache-bucket',
      Key: `dataManagement/lookupPubkeysBySqlId`,
      Body: await fooFxn(oPubkeysBySqlId)
    }

    const command_put = new PutObjectCommand(params_put);
    const response_put = await client.send(command_put);

    console.log(response_put)

    const currentTimestamp = Math.floor(Date.now() / 1000)

    const response: ResponseData = {
      success: true,
      message: 'Results of your addPubkeysBySqlIdLookupToS3 query:',
      data: {
        numRows: aResults1.length,
        megabyteSize,
        whenLastUpdated: currentTimestamp,
        oPubkeysBySqlId
      }
    }
    res.status(200).json(response)
  } catch (e) {
    console.log(e)
  }
}
