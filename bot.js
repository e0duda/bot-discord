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

  // ALTERAR MENSAGEM DE DIVULGAÇÃO
  if (alterandoMensagem) {
    mensagemDivulgacao = message.content;
    alterandoMensagem = false;
    return message.reply("Mensagem de divulgação atualizada.");
  }

  // SORTEAR VENCEDOR
  if (message.content === "!sortear") {
    if (!sorteioAtivo) {
      return message.reply("Nenhum sorteio ativo.");
    }

    if (participantes.size === 0) {
      return message.reply("Ninguém participou do sorteio.");
    }

    const lista = Array.from(participantes);
    const vencedor = lista[Math.floor(Math.random() * lista.length)];

    sorteioAtivo = false;
    participantes.clear();

    const embed = new EmbedBuilder()
      .setTitle("🎉 Sorteio Encerrado")
      .setDescription(`O vencedor foi: <@${vencedor}>`)
      .setColor(0x00ff99);

    return message.channel.send({ embeds: [embed] });
  }

  // ABRIR PAINEL
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
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("criar_sorteio")
        .setLabel("Criar Sorteio")
        .setStyle(ButtonStyle.Secondary)
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

  // CRIAR SORTEIO
  if (interaction.customId === "criar_sorteio") {
    if (sorteioAtivo) {
      return interaction.reply({
        content: "Já existe um sorteio ativo.",
        ephemeral: true
      });
    }

    sorteioAtivo = true;
    participantes.clear();

    const embed = new EmbedBuilder()
      .setTitle("🎉 Sorteio Iniciado")
      .setDescription("Clique no botão para participar!\n\nParticipantes: 0")
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
        content: "Não há sorteio ativo.",
        ephemeral: true
      });
    }

    if (participantes.has(interaction.user.id)) {
      return interaction.reply({
        content: "Você já entrou no sorteio.",
        ephemeral: true
      });
    }

    participantes.add(interaction.user.id);

    const embedAtualizado = new EmbedBuilder()
      .setTitle("🎉 Sorteio Ativo")
      .setDescription(
        `Clique no botão para participar!\n\nParticipantes: ${participantes.size}\nÚltimo participante: <@${interaction.user.id}>`
      )
      .setColor(0x5865f2);

    await mensagemSorteio.edit({
      embeds: [embedAtualizado]
    });

    return interaction.reply({
      content: "Você entrou no sorteio!",
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
