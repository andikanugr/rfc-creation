exports.Member=function(accounts){
    this.githubToSlack = {}
    this.slackToGithub = {}
    this.githubToJira = {}
    this.jiraToSlack = {}
    this.CAB = []
    this.PO = []


    for (const account of accounts){
        this.githubToJira[account[0]] = account[2]
        this.githubToSlack[account[0]] = account[1]
        this.slackToGithub[account[1]] = account[0]
        this.jiraToSlack[account[2]] = account[1]
        
        switch(account[3]){
            case "CAB":
                this.CAB.push(account[2])
                break;
            case "PO":
                this.PO.push(account[2])
                break;
        }
    }

    this.getSlackFromGithub = function(gh) {
        return this.githubToSlack[gh]
    }

    this.getJiraFromGithub = function(gh) {
        return this.githubToJira[gh]
    }

    this.getGithubFromSlack = function(s) {
        return this.slackToGithub[s]
    }

    this.getSlackFromJira = function(j) {
        return this.jiraToSlack[j]
    }

    this.getCAB = function(){
        return this.CAB
    }

    this.getPO = function(){
        return this.PO
    }
}