export type Pubkey = string

// minimum 6 characrters containing the first part of a pubkey
// full pubkey MUST be included in the containing dataset to decode PubkeyBreve
// PubkeyBreve MAY include additional caracters from pubkey to avoid duplicates within the dataset
type PubkeyBreve = string

type RatingData = {
    rator : Pubkey | PubkeyBreve, 
    timestamp : number,
    [edgemeta : string] : string | number | undefined
}

// a normalized ratings object returned by ANY request for rattings data
// where EVERY instance of PubkeyBreve is represented by a key (as pubkey)
export type PubkeyRatingsMap = {
    [ratee:Pubkey] :  RatingData[],
}

export type RatingsRequest = {
    ratingKind : number // 'follows' = 3, 'mutes' = 10000, 'reports' = 1984 Tells us what kind of ratings to return 
    rators : Pubkey[],
    dos ? : number, // 0 means full network; 1 means only the provided pubkeys; 2 means one more hop, etc; undefined means default to 1
    networkKind ? : number, // 3 means use follows to define the network; if undefined, networkKind equals ratingKind
}

// export type EntireNetwork = AllPubkeysNHopsAway[]

/*
// example: 
const allPubkeysNHopsAway:AllPubkeysNHopsAway = {
    0: [
        {
            pubkey: <Pubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        },
        {
            pubkey: <Pubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        }
    ].
    1: {
        
            abbreviation: <abbrPubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        },
        <pubkey2>: {
            abbreviation: <abbrPubkey>,
            folllowedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            mutedBy: [<abbrPubkey1>, <abbrPubkey2> ...],
            reportedBy: {
                nudity: [<abbrPubkey1>, <abbrPubkey2> ...],
                malware: [<abbrPubkey1>, <abbrPubkey2> ...],
                profanity: [<abbrPubkey1>, <abbrPubkey2> ...],
                illegal: [<abbrPubkey1>, <abbrPubkey2> ...],
                spam: [<abbrPubkey1>, <abbrPubkey2> ...],
                impersonation: [<abbrPubkey1>, <abbrPubkey2> ...],
                other: [<abbrPubkey1>, <abbrPubkey2> ...],
            }
        }
    },
    ...
}
*/
