let progressoMsg;

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

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
      .setTitle("📡 Enviando Divulgação")
      .setDescription("Iniciando envio...")
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
