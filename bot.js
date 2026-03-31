const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const Database = require("better-sqlite3");

const db = new Database("database.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS usuarios_dm (
  id TEXT PRIMARY KEY
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS sorteio (
  id TEXT PRIMARY KEY
)
`).run();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let mensagemDivulgacao = "Mensagem ainda não configurada.";

let progresso = {
  enviadas: 0,
  falhas: 0,
  total: 0,
  rodando: false,
  parar: false
};

let progressoMsg;

// BOT ONLINE
client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// COMANDO PAINEL
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  if (message.content === "!painel") {
    const embed = new EmbedBuilder()
      .setTitle("Painel do Bot")
      .setDescription("Controle o bot pelos botões abaixo.")
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("enviar")
        .setLabel("Enviar Divulgação")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("mensagem")
        .setLabel("Alterar Mensagem")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("parar")
        .setLabel("Parar Divulgação")
        .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("criar_sorteio")
        .setLabel("Criar Sorteio")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("sortear")
        .setLabel("Sortear Vencedor")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("limpar_dm")
        .setLabel("Limpar DMs")
        .setStyle(ButtonStyle.Danger)
    );

    message.channel.send({
      embeds: [embed],
      components: [row, row2]
    });
  }
});

// BOTÕES
client.on("interactionCreate", async (interaction) => {
  if (interaction.isButton()) {
    
    // ALTERAR MENSAGEM
    if (interaction.customId === "mensagem") {
      const modal = new ModalBuilder()
        .setCustomId("modalMensagem")
        .setTitle("Alterar Mensagem de Divulgação");

      const input = new TextInputBuilder()
        .setCustomId("novaMensagem")
        .setLabel("Digite a nova mensagem")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    // PARAR DIVULGAÇÃO
    if (interaction.customId === "parar") {
      progresso.parar = true;
      return interaction.reply({
        content: "Divulgação será parada.",
        ephemeral: true
      });
    }

    // ENVIAR DIVULGAÇÃO
    if (interaction.customId === "enviar") {
      if (progresso.rodando) {
        return interaction.reply({
          content: "Já existe uma divulgação em andamento.",
          ephemeral: true
        });
      }

      progresso = {
        enviadas: 0,
        falhas: 0,
        total: 0,
        rodando: true,
        parar: false
      };

      const guild = interaction.guild;
      await guild.members.fetch();

      const membros = guild.members.cache.filter(m => !m.user.bot);
      progresso.total = membros.size;

      const embed = new EmbedBuilder()
        .setTitle("Iniciando Divulgação")
        .setColor(0x2b2d31);

      await interaction.reply({ embeds: [embed] });
      progressoMsg = await interaction.fetchReply();

      for (const member of membros.values()) {
        if (progresso.parar) break;

        try {
          await member.send(mensagemDivulgacao);

          db.prepare(
            "INSERT OR IGNORE INTO usuarios_dm (id) VALUES (?)"
          ).run(member.id);

          progresso.enviadas++;
        } catch {
          progresso.falhas++;
        }

        const progressoEmbed = new EmbedBuilder()
          .setTitle("Progresso da Divulgação")
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
        .setTitle("Divulgação Finalizada")
        .setDescription(
          `Total: ${progresso.total}
Enviadas: ${progresso.enviadas}
Falhas: ${progresso.falhas}`
        )
        .setColor(0x00ff99);

      await progressoMsg.edit({ embeds: [finalEmbed] });
    }

    // CRIAR SORTEIO
    if (interaction.customId === "criar_sorteio") {
      const embed = new EmbedBuilder()
        .setTitle("Sorteio")
        .setDescription("Clique no botão para participar!")
        .setColor(0xf1c40f);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("participar")
          .setLabel("Participar")
          .setStyle(ButtonStyle.Success)
      );

      return interaction.channel.send({
        embeds: [embed],
        components: [row]
      });
    }

    // PARTICIPAR DO SORTEIO
    if (interaction.customId === "participar") {
      db.prepare(
        "INSERT OR IGNORE INTO sorteio (id) VALUES (?)"
      ).run(interaction.user.id);

      return interaction.reply({
        content: "Você entrou no sorteio!",
        ephemeral: true
      });
    }

    // SORTEAR
    if (interaction.customId === "sortear") {
      const participantes = db
        .prepare("SELECT id FROM sorteio")
        .all();

      if (participantes.length === 0) {
        return interaction.reply("Ninguém participou.");
      }

      const vencedor =
        participantes[Math.floor(Math.random() * participantes.length)];

      interaction.channel.send(
        `Vencedor: <@${vencedor.id}>`
      );
    }

    // LIMPAR DMS
    if (interaction.customId === "limpar_dm") {
      const usuarios = db
        .prepare("SELECT id FROM usuarios_dm")
        .all();

      let apagadas = 0;

      for (const user of usuarios) {
        try {
          const usuario = await client.users.fetch(user.id);
          const dm = await usuario.createDM();
          const msgs = await dm.messages.fetch({ limit: 50 });

          for (const msg of msgs.values()) {
            if (msg.author.id === client.user.id) {
              await msg.delete().catch(() => {});
              apagadas++;
            }
          }
        } catch {}
      }

      interaction.reply(`DMs apagadas: ${apagadas}`);
    }
  }

  // MODAL
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "modalMensagem") {
      mensagemDivulgacao =
        interaction.fields.getTextInputValue("novaMensagem");

      interaction.reply({
        content: "Mensagem de divulgação atualizada!",
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);
