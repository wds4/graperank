import { verifyPubkeyValidity } from '@/helpers/nip19'
import type { NextApiRequest, NextApiResponse } from 'next'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { Dos, GrapeRank, PPR, PprScore, PprScores, ResponseData, Scorecards } from '@/types'

/*
usage:
pubkey: e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f
https://www.graperank.tech/api/algos/combineAllWebsOfTrust/outputToS3?pubkey=e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f

726a1e261cc6474674e8285e3951b3bb139be9a773d1acf49dc868db861a1c11 (franzap)
https://www.graperank.tech/api/algos/combineAllWebsOfTrust/outputToS3?pubkey=726a1e261cc6474674e8285e3951b3bb139be9a773d1acf49dc868db861a1c11

*/

const client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
})

type pubkey = string

type PwotScores = {[key:pubkey]: number[]}

type PwotData = {
  numPubkeysTotal: number,
  scores?:PwotScores, // PprScores
}

type PwotMetaData = {
  whenLastUpdated: {
    synthesis: number,
    dos: number,
    personalizedPageRank: number,
  },
  referencePubkey: string,
}

type PWoT = {
  metaData: PwotMetaData,
  data: PwotData
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const searchParams = req.query
  if (!searchParams.pubkey) {
    const response:ResponseData = {
      success: false,
      message: `api/algos/combineAllWebsOfTrust/outputToS3: pubkey was not provided`
    }
    res.status(500).json(response)
  }
  if (searchParams.pubkey) {
    const pubkey1 = searchParams.pubkey
    if (typeof pubkey1 == 'string' && verifyPubkeyValidity(pubkey1)) {
      try {
        const params_get0 = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `dataManagement/lookupPubkeysBySqlId`,
        }

        const params_get1 = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${pubkey1}/dos`,
        }

        const params_get2 = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${pubkey1}/personalizedPageRank`,
        }

        const params_get3 = {
          Bucket: 'grapevine-nostr-cache-bucket',
          Key: `customerData/${pubkey1}/graperank`,
        }

        const command_get0 = new GetObjectCommand(params_get0);
        const response_get0 = await client.send(command_get0);
        const sLookupPubkeysBySqlId = await response_get0.Body?.transformToString()

        const command_get1 = new GetObjectCommand(params_get1);
        const response_get1 = await client.send(command_get1);
        const sDos = await response_get1.Body?.transformToString()
        
        const command_get2 = new GetObjectCommand(params_get2);
        const response_get2 = await client.send(command_get2);
        const sPPR = await response_get2.Body?.transformToString()

        const command_get3 = new GetObjectCommand(params_get3);
        const response_get3 = await client.send(command_get3);
        const sGrapeRank = await response_get3.Body?.transformToString()

        if (typeof sLookupPubkeysBySqlId == 'string' && typeof sDos == 'string' && typeof sPPR == 'string' && typeof sGrapeRank == 'string') {
          const oLookupPubkeysBySqlId = JSON.parse(sLookupPubkeysBySqlId)
          const oDos:Dos = JSON.parse(sDos)
          const oPPR:PPR = JSON.parse(sPPR)
          const oGrapeRank:GrapeRank = JSON.parse(sGrapeRank)

          const aPubkeysByHop = oDos.data.pubkeysByDoS
          // const aPubkeysByHop = Object.keys(oDos.data.pubkeysByDoS)
          const aPPR:PprScores = oPPR.data.scores
          const oScorecards:Scorecards = oGrapeRank.data.scorecards
          const aGrapeRank = Object.keys(oScorecards)

          const oPwotScores:PwotScores = {}
          const oFoo:{[key:string]: { dos: number, personalPageRank: number, grapeRank_average: number, grapeRank_confidence: number }} = {}
          
          // dos 
          for (let hop=0; hop < aPubkeysByHop.length; hop++) {
            const aPubkeys = aPubkeysByHop[hop]
            for (let z=0; z < aPubkeys.length; z++) {
              const pk = aPubkeys[z]
              // oPwotScores[pk] = [hop, 0, 0, 0]
              oFoo[pk] = {
                dos: hop,
                personalPageRank: -1,
                grapeRank_average: -1,
                grapeRank_confidence: -1,
              }
            }
          }

          // personalized pageRank
          for (let x=0; x < aPPR.length; x++) {
            const oBar:PprScore = aPPR[x]
            const pk = oBar.pubkey
            const score = oBar.score
            if (oFoo[pk]) {
              oFoo[pk].personalPageRank = score
            } else {
              oFoo[pk] = {
                dos: 999,
                personalPageRank: score,
                grapeRank_average: -1,
                grapeRank_confidence: -1,
              }
            }
          }

          // grapeRank
          for (let x=0; x < aGrapeRank.length; x++) {
            const observeeId:string = aGrapeRank[x]
            const observeePubkey =  oLookupPubkeysBySqlId[observeeId]
            const average = oScorecards[observeeId][2]
            const confidence = oScorecards[observeeId][1]
            if (oFoo[observeePubkey]) {
              oFoo[observeePubkey].grapeRank_average = average
              oFoo[observeePubkey].grapeRank_confidence = confidence
            } else {
              oFoo[observeePubkey] = {
                dos: 999,
                personalPageRank: -1,
                grapeRank_average: average,
                grapeRank_confidence: confidence,
              }
            }
          }

          const aFoo = Object.keys(oFoo)
          for (let a=0; a < aFoo.length; a++) {
            const pk = aFoo[a]
            oPwotScores[pk] = [ oFoo[pk].dos, oFoo[pk].personalPageRank, oFoo[pk].grapeRank_average, oFoo[pk].grapeRank_confidence ]
          }

          /*
          // go through oDos and oPPR to create the output object
          {
            pk1: [dos, personalPageRank, grapeRank_average, grapeRank_confidence],
            pk2 [dos, personalPageRank, grapeRank_average, grapeRank_confidence],
          }
          */

          /* PutObjectCommand */
          const currentTimestamp = Math.floor(Date.now() / 1000)
          const oPersonalizedWebsOfTrust:PWoT = {
            metaData: {
              whenLastUpdated: {
                synthesis: currentTimestamp,
                dos: oDos.metaData.whenLastUpdated,
                personalizedPageRank: oPPR.metaData.whenLastUpdated,
              },
              referencePubkey: pubkey1, 
            },
            data: {
              numPubkeysTotal: aFoo.length,
              scores: oPwotScores,
            },
          }

          const fooFxn = async (oPersonalizedWebsOfTrust:PWoT) => {
            const sOutput = JSON.stringify(oPersonalizedWebsOfTrust)
            return sOutput
          }

          const params_put = {
            Bucket: 'grapevine-nostr-cache-bucket',
            Key: `customerData/${pubkey1}/combinedWebsOfTrust`,
            Body: await fooFxn(oPersonalizedWebsOfTrust)
          }

          const command_put = new PutObjectCommand(params_put);
          const response_put = await client.send(command_put);

          console.log(typeof response_put)

          const response:ResponseData = {
            success: true,
            exists: true,
            message: `api/algos/combineAllWebsOfTrust/outputToS3 data:`,
            data: {
              oPersonalizedWebsOfTrust,
            }
          }
          res.status(200).json(response)
        } else {
          // error 
          const response = {
            success: false,
            message: `api/algos/combineAllWebsOfTrust/outputToS3: data not available or not properly formatted`,
            data: {
              pubkey1,
            }
          }
          res.status(500).json(response)
        }

      } catch (error) {
        const response = {
          success: false,
          message: `api/algos/combineAllWebsOfTrust/outputToS3 error: ${error}`,
          data: {
            pubkey1,
          }
        }
        res.status(500).json(response)
      }
    } else {
      const response:ResponseData = {
        success: false,
        message: `api/algos/combineAllWebsOfTrust/outputToS3: the provided pubkey is invalid`,
        data: {
          pubkey1
        }
      }
      res.status(500).json(response)
    }
  } else {
    const response:ResponseData = {
      success: false,
      message: `api/algos/combineAllWebsOfTrust/outputToS3: pubkey was not provided`
    }
    res.status(500).json(response)
  }
}