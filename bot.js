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

const sqlite3 = require("sqlite3").verbose();

// BANCO DE DADOS
const db = new sqlite3.Database("./database.db");

db.run(`
CREATE TABLE IF NOT EXISTS usuarios_dm (
  id TEXT PRIMARY KEY
)
`);

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

// SISTEMA DE SORTEIO
let participantes = new Set();
let sorteioAtivo = false;
let mensagemSorteio;

// BOT ONLINE
client.once("ready", () => {
  console.log(`Bot online como ${client.user.tag}`);
});

// COMANDOS
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // PARAR DIVULGAÇÃO
  if (message.content === "!parar") {
    if (!progresso.rodando) {
      return message.reply("Não existe divulgação rodando.");
    }

    progresso.parar = true;
    return message.reply("⛔ Parando divulgação...");
  }

  // LIMPAR DMS
  if (message.content === "!limpardm") {
    message.reply("🧹 Limpando DMs enviadas pelo bot...");

    db.all("SELECT id FROM usuarios_dm", async (err, rows) => {
      if (err) return;

      for (const row of rows) {
        try {
          const user = await client.users.fetch(row.id);
          const dm = await user.createDM();

          const mensagens = await dm.messages.fetch({ limit: 100 });

          for (const msg of mensagens.values()) {
            if (msg.author.id === client.user.id) {
              await msg.delete().catch(() => {});
            }
          }
        } catch {}
      }

      message.channel.send("✅ Limpeza concluída.");
    });
  }

  // SORTEAR
  if (message.content === "!sortear") {
    if (!sorteioAtivo) {
      return message.reply("Nenhum sorteio ativo.");
    }

    if (participantes.size === 0) {
      return message.reply("Ninguém participou.");
    }

    const lista = Array.from(participantes);
    const vencedor = lista[Math.floor(Math.random() * lista.length)];

    sorteioAtivo = false;
    participantes.clear();

    const embed = new EmbedBuilder()
      .setTitle("🎉 Sorteio Encerrado")
      .setDescription(`Vencedor: <@${vencedor}>`)
      .setColor(0x00ff99);

    return message.channel.send({ embeds: [embed] });
  }

  // PAINEL
  if (message.content === "!painel") {
    const embed = new EmbedBuilder()
      .setTitle("Painel de Divulgação")
      .setDescription("Controle o bot abaixo.")
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
        .setCustomId("criar_sorteio")
        .setLabel("Criar Sorteio")
        .setStyle(ButtonStyle.Secondary)
    );

    message.channel.send({ embeds: [embed], components: [row] });
  }
});

// INTERAÇÕES
client.on("interactionCreate", async (interaction) => {

  if (interaction.isButton()) {

    // ALTERAR MENSAGEM (MODAL)
    if (interaction.customId === "mensagem") {
      const modal = new ModalBuilder()
        .setCustomId("modal_mensagem")
        .setTitle("Alterar mensagem de divulgação");

      const input = new TextInputBuilder()
        .setCustomId("nova_mensagem")
        .setLabel("Digite a nova mensagem")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      return interaction.showModal(modal);
    }

    // CRIAR SORTEIO
    if (interaction.customId === "criar_sorteio") {
      if (sorteioAtivo) {
        return interaction.reply({
          content: "Já existe sorteio ativo.",
          ephemeral: true
        });
      }

      sorteioAtivo = true;
      participantes.clear();

      const embed = new EmbedBuilder()
        .setTitle("🎉 Sorteio Iniciado")
        .setDescription("Clique para participar!\n\nParticipantes: 0")
        .setColor(0x5865f2);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("participar_sorteio")
          .setLabel("Participar")
          .setStyle(ButtonStyle.Success)
      );

      await interaction.reply({
        embeds: [embed],
        components: [row]
      });

      mensagemSorteio = await interaction.fetchReply();
    }

    // PARTICIPAR DO SORTEIO
    if (interaction.customId === "participar_sorteio") {
      if (!sorteioAtivo) {
        return interaction.reply({
          content: "Sorteio encerrado.",
          ephemeral: true
        });
      }

      if (participantes.has(interaction.user.id)) {
        return interaction.reply({
          content: "Você já entrou.",
          ephemeral: true
        });
      }

      participantes.add(interaction.user.id);

      const embedAtualizado = new EmbedBuilder()
        .setTitle("🎉 Sorteio Ativo")
        .setDescription(
          `Participantes: ${participantes.size}\nÚltimo: <@${interaction.user.id}>`
        )
        .setColor(0x5865f2);

      await mensagemSorteio.edit({ embeds: [embedAtualizado] });

      return interaction.reply({
        content: "Você entrou no sorteio!",
        ephemeral: true
      });
    }

    // ENVIAR DIVULGAÇÃO
    if (interaction.customId === "enviar") {
      if (progresso.rodando) {
        return interaction.reply({
          content: "Já existe envio em andamento.",
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
        .setTitle("📡 Iniciando Divulgação")
        .setColor(0x2b2d31);

      await interaction.reply({ embeds: [embed] });
      progressoMsg = await interaction.fetchReply();

      for (const member of membros.values()) {

        if (progresso.parar) break;

        try {
          await member.send(mensagemDivulgacao);

          // salvar no banco
          db.run(
            "INSERT OR IGNORE INTO usuarios_dm (id) VALUES (?)",
            [member.id]
          );

          progresso.enviadas++;
        } catch {
          progresso.falhas++;
        }

        const progressoEmbed = new EmbedBuilder()
          .setTitle("📡 Progresso")
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
          `Enviadas: ${progresso.enviadas}
Falhas: ${progresso.falhas}`
        )
        .setColor(0x00ff99);

      await progressoMsg.edit({ embeds: [finalEmbed] });
    }
  }

  // MODAL
  if (interaction.isModalSubmit()) {
    if (interaction.customId === "modal_mensagem") {
      mensagemDivulgacao =
        interaction.fields.getTextInputValue("nova_mensagem");

      return interaction.reply({
        content: "Mensagem atualizada com sucesso.",
        ephemeral: true
      });
    }
  }

});

client.login(process.env.TOKEN);
