const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let mensagemDivulgacao = "Mensagem ainda não configurada.";
let alterandoMensagem = false;

let progresso = {
  enviadas: 0,
  falhas: 0,
  total: 0,
  rodando: false
};

let progressoMsg;

// BOT ONLINE
client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// COMANDO PARA ABRIR O PAINEL
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (alterandoMensagem) {
    mensagemDivulgacao = message.content;
    alterandoMensagem = false;
    return message.reply("Mensagem de divulgação atualizada.");
  }

  if (message.content === "!painel") {
    const embed = new EmbedBuilder()
      .setTitle("Painel de Divulgação")
      .setDescription("Controle o envio pelo painel abaixo.")
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("enviar")
        .setLabel("Enviar Divulgação")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("mensagem")
        .setLabel("Alterar Mensagem")
        .setStyle(ButtonStyle.Primary)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// BOTÕES
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // ALTERAR MENSAGEM
  if (interaction.customId === "mensagem") {
    alterandoMensagem = true;
    return interaction.reply({
      content: "Envie a nova mensagem de divulgação no chat.",
      ephemeral: true
    });
  }

  // ENVIAR DIVULGAÇÃO
  if (interaction.customId === "enviar") {
    if (progresso.rodando) {
      return interaction.reply({
        content: "Já existe um envio em andamento.",
        ephemeral: true
      });
    }

    progresso = { enviadas: 0, falhas: 0, total: 0, rodando: true };

    const guild = interaction.guild;
    await guild.members.fetch();

    const membros = guild.members.cache.filter(m => !m.user.bot);
    progresso.total = membros.size;

    const embed = new EmbedBuilder()
      .setTitle("📡 Iniciando Divulgação")
      .setDescription("Preparando envio...")
      .setColor(0x2b2d31);

    await interaction.reply({ embeds: [embed] });
    progressoMsg = await interaction.fetchReply();

    for (const member of membros.values()) {
      try {
        await member.send(mensagemDivulgacao);
        progresso.enviadas++;
      } catch {
        progresso.falhas++;
      }

      const progressoEmbed = new EmbedBuilder()
        .setTitle("📡 Progresso da Divulgação")
        .setDescription(
          `Total: ${progresso.total}
Enviadas: ${progresso.enviadas}
Falhas: ${progresso.falhas}`
        )
        .setColor(0x2b2d31);

      await progressoMsg.edit({ embeds: [progressoEmbed] });

      await new Promise(r => setTimeout(r, 1200));
    }

    progresso.rodando = false;

    const finalEmbed = new EmbedBuilder()
      .setTitle("✅ Divulgação Finalizada")
      .setDescription(
        `Total: ${progresso.total}
Enviadas: ${progresso.enviadas}
Falhas: ${progresso.falhas}`
      )
      .setColor(0x00ff99);

    await progressoMsg.edit({ embeds: [finalEmbed] });
  }
});

client.login(process.env.TOKEN);
