const { Member, Sheet, Slack, Jira } = require("dg-action-tools");


const slackChannel = process.env.SLACK_CHANNEL
const sheetId = process.env.GOOGLE_SHEET_ID
const keys = process.env.GOOGLE_ACCOUNT_KEY
const slackToken = process.env.SLACK_BOT_TOKEN
const slackSecret = process.env.SLACK_BOT_SECRET


const jiraToken = process.env.JIRA_TOKEN
const jiraEmail = process.env.JIRA_EMAIL
const jiraHost = process.env.JIRA_HOST

const projejectId = "10361"
const issueTypeRFC = "10517"
const cahngeStadard = "16612"
const versionTypeMinor = "16617"
const riskLevelMedium = "17987"

const jiraStatusReadyForApproval = "10181"
const jiraStatusDone = "10087"

const servicesObj = {
    b2binteg: "16069",
    b2bpartner: "16101",
    b2bfulfill: "16522",
    b2bintegrationsandbox: "16504",
    b2bintools: "16070",
    digitalb2bcatalog: "15577",
    digitalb2border: "15578",
    digitalintoolsb2b: "15552"
}

let member = new Member([])

const slack = new Slack(slackToken, slackSecret)
const sheet = new Sheet(keys, sheetId)
const jira = new Jira(jiraToken, jiraEmail, jiraHost)


async function main(){
    const deploymentLog = await sheet.batchGet("deployment log!A1:Q10")
    const deploymentLogObjs = sheet.valuesToObjects(deploymentLog)

    const userAccount = await sheet.batchGet("user mapping")
    const users = sheet.valueToArray(userAccount)
    member = new Member(users)

    await deploymentLogObjs.reduce(async (acc, dlo, i) => {
        await acc
        await getReadyForRFCLog(dlo, i)
    }, 0)
}

async function getReadyForRFCLog(obj, i) {
    let rowNum = i + 2
    if(obj.Status == "RFC"){
        const task = await createRFC(obj)
        if(task.success){
            obj.Status = "DEP"
            obj.RFC = `${jiraHost}/browse/${task.key}`
            await updateDeploymentLog(rowNum, obj)
            await updateThread(obj)
        }
        informRFCResult(obj, task)
    }
}

async function createRFC(obj){
    // eic
    let EICs = []
    const EIC = obj.EIC.split(",")
    EIC.map(v => {
        if(member.getJiraFromGithub(v)) EICs.push({"accountId": member.getJiraFromGithub(v)})
    })

    // cab
    let CABs = []
    const CAB = member.getCAB()
    CAB.map(v => CABs.push({"accountId": v}))
    
    // po
    let POs = []
    const PO = member.getPO()
    PO.map(v => POs.push({"accountId": v}))

    const tasks = obj.Tasks.split(",")
    let linked = []
    await Promise.all(tasks.map(async v => {
        const statusTask = await jira.getStatus(v)
        if(statusTask && (statusTask.status.id == jiraStatusReadyForApproval || statusTask.status.id == jiraStatusDone)){
            linked.push(v)
        }
    }))

    const data = {
        "project": {
            "id": projejectId
        },
        "issuetype": {
            "id": issueTypeRFC
        },

        // Date Request
        "customfield_11702": new Date(),

        // Type Of Change
        "customfield_11703": {
            // Standard chnages
            "id": cahngeStadard,
        },

        // CAB
        "customfield_12748": CABs,

        // EIC
        "customfield_12277": EICs,

        // Product Owner
        "customfield_11783": POs,

        // Github Deployer number request
        "customfield_11706": obj.Release,

        // Latest Stable Version Number
        "customfield_11708": obj.Stable,

        // Schedule to Deployment
        "customfield_11707": new Date(),

        // Version Type
        "customfield_11709": {
            "id": versionTypeMinor
        },

        // Service Name
        "customfield_11685": {
            // b2bpartner
            "id": servicesObj[obj.Service]
        },
        // Risk level
        "customfield_12279": {
            "id": riskLevelMedium
        },

        // Potential risk
        "customfield_11715": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "-"
                        }
                    ]
                }
            ]
        },

        // Pre Deployment Checklist
        "customfield_12282": "-",

        // Post Deployement Checklish
        "customfield_12285": "-",

        // Summary
        "summary": `Deployment ${obj.Service} (${obj.Tag})`,

        "description": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": obj.Description
                        }
                    ]
                }
            ]
        },

        // Rollback Plan
        "customfield_11575": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "-"
                        }
                    ]
                }
            ]
        },

        // Monitoring Link
        "customfield_12284": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "newrelic"
                        }
                    ]
                }
            ]
        },

        // Deployment Procedure
        "customfield_12283": {
            "type": "doc",
            "version": 1,
            "content": [
                {
                    "type": "paragraph",
                    "content": [
                        {
                            "type": "text",
                            "text": "jenkins"
                        }
                    ]
                }
            ]
        },

    }
    return await jira.createTask(data, linked)
}

async function updateDeploymentLog(i, obj){
    await sheet.updateValue(`A${i}`, obj)
}

async function updateThread(obj){
    obj.PIC = member.getSlackFromGithub(obj.PIC)
    await slack.DGupdateDeploymentThread(slackChannel, obj.Thread, obj)
}

function informRFCResult(obj, task){
    let msg
    if(task.success){
        msg = `RFC created please continue to the next step <@${obj.PIC}>`
    }else{
        msg = `Failed to create RFC please check! <@${obj.PIC}>`
        msg += "\n```" + JSON.stringify(task) + "```" 
    }
    slack.replyThread(slackChannel, obj.Thread, msg)
}


main()