workflow "New workflow" {
  on = "push"
  resolves = ["Deploy with Serverless"]
}

action "Only on master branch" {
  uses = "actions/bin/filter@b2bea07"
  args = "branch master"
}

action "Deploy with Serverless" {
  uses = "serverless/github-action@master"
  args = "deploy"
  needs = ["Only on master branch"]
  secrets = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]
}
