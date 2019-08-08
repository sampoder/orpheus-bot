import { airFind } from '../utils'

const renameInteraction = (bot, message) => {
  const { user, channel, text } = message

  bot.replyAcknowledge()

  airFind('Clubs', 'Slack Channel ID', channel).then(club => {
    if (!club || !club.fields) {
      console.log('*no club or fields set*')
      bot.whisper(message, `This command only works on club channels.`)
    } else if (club.fields['Leader Slack IDs'].indexOf(user) === -1) {
      // user not found in club's list of leaders
      console.log("*user isn't a leader*")
      bot.whisper(message, `Only this club's leaders can run this command. You aren't marked as this club's leader.`)
    } else {
      console.log(`*Renaming the channel to "${text}*`)
      bot.whisper(message, `You got it boss! Renaming the channel to "${text}"...`)
      bot.api.channels.rename({
        channel,
        name: text,
        token: process.env.SLACK_TOKEN
      }, (err, res) => {
        if (err) console.error(err)
      })
    }
  }).catch(err => {
    console.error(err)
    bot.whisper(message, `hmm... something went wrong. I tried clicking "rename" but it says "${err}" in red`)
  })
}
export default renameInteraction