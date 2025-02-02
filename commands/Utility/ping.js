const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const yaml = require("yaml");
const configFile = fs.readFileSync("./config.yml", "utf8");
const config = yaml.parse(configFile);
const { configEmbed } = require("../../index.js");

module.exports = {
  enabled: config.commands.ping.enabled,
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Execute the ping command.")
    .setDefaultMemberPermissions(
      PermissionFlagsBits[config.commands.ping.permission],
    )
    .setDMPermission(false),
  async execute(interaction) {
    await interaction.deferReply();

    const defaultDMValues = {
      color: "#2FF200",
      title: "Ping & Latency",
      timestamp: true,
      footer: {
        text: `Requested by ${interaction.user.username}`,
        iconURL: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
      },
    };

    const pingEmbed = await configEmbed("pingEmbed", defaultDMValues);

    pingEmbed.addFields([
      {
        name: "Ping",
        value: interaction.client.ws.ping + "ms",
        inline: true,
      },
      {
        name: "Latency",
        value: `${performance.now() - interaction.createdTimestamp}ms`,
        inline: true,
      },
    ]);

    await interaction.editReply({ embeds: [pingEmbed] });
  },
};
