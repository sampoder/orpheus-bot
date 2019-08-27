import { initBot } from "../utils";

const checkinNotifierInteraction = (bot=initBot(), message) => {
  const text = "Hey! My calendar shows you had a meeting recently. If you did you can react to this message with an emoji to let me know."

  bot.say({
    text,
    channel: message.channel
  })
}

export default checkinNotifierInteraction