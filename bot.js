const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`Bot ligado: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.content === "!dmall") {

    const msgStatus = await message.reply("Iniciando envio de DMs...");

    const members = await message.guild.members.fetch();

    let enviados = 0;
    let falhas = 0;
    let total = 0;

    for (const [id, member] of members) {
      if (member.user.bot) continue;

      total++;

      try {
        await member.send(`**Assim que acabar a live hoje, terá uma promoção de 50% em todos os produtos do servidor durante 30 minutos.**
https://discord.gg/UtUbyJ8JeU`);

        enviados++;
      } catch {
        falhas++;
      }

      // pequeno delay para evitar bloqueio
      await new Promise(r => setTimeout(r, 1200));
    }

    await msgStatus.edit(
      `Envio finalizado ✅

👥 Total verificado: ${total}
📩 Receberam a DM: ${enviados}
❌ Não receberam: ${falhas}`
    );
  }
});

client.login(process.env.TOKEN);