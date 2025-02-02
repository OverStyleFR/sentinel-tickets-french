const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const yaml = require("yaml");
const configFile = fs.readFileSync("./config.yml", "utf8");
const config = yaml.parse(configFile);
const {
  ticketsDB,
  sanitizeInput,
  logMessage,
  ticketCategories,
  mainDB,
  checkSupportRole,
  configEmbed,
} = require("../../index.js");

module.exports = {
  enabled: config.commands.claim.enabled,
  data: new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim a ticket")
    .setDefaultMemberPermissions(
      PermissionFlagsBits[config.commands.claim.permission],
    )
    .setDMPermission(false),
  async execute(interaction) {
    if (!(await ticketsDB.has(interaction.channel.id))) {
      return interaction.reply({
        content: config.errors.not_in_a_ticket,
        ephemeral: true,
      });
    }

    const hasSupportRole = await checkSupportRole(interaction);
    if (!hasSupportRole) {
      return interaction.reply({
        content: config.errors.not_allowed,
        ephemeral: true,
      });
    }

    if (config.claimFeature === false) {
      return interaction.reply({
        content: "The claim feature is currently disabled.",
        ephemeral: true,
      });
    }

    let claimStatus = await ticketsDB.get(`${interaction.channel.id}.claimed`);
    let claimUser = await ticketsDB.get(`${interaction.channel.id}.claimUser`);

    if (claimStatus) {
      return interaction.reply({
        content: `This ticket has already been claimed by <@!${claimUser}>`,
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });
    const totalClaims = await mainDB.get("totalClaims");

    const defaultValues = {
      color: "#2FF200",
      title: "Ticket Claimed",
      description: `This ticket has been claimed by {user}.\nThey will be assisting you shortly!`,
      timestamp: true,
      footer: {
        text: `Claimed by ${interaction.user.tag}`,
        iconURL: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
      },
    };

    const claimedEmbed = await configEmbed("claimedEmbed", defaultValues);

    if (claimedEmbed.data && claimedEmbed.data.description) {
      claimedEmbed.setDescription(
        claimedEmbed.data.description.replace(/\{user\}/g, interaction.user),
      );
    }

    await interaction.editReply({
      content: "You successfully claimed this ticket!",
      ephemeral: true,
    });
    interaction.channel.send({ embeds: [claimedEmbed], ephemeral: false });

    interaction.channel.messages
      .fetch(await ticketsDB.get(`${interaction.channel.id}.msgID`))
      .then(async (message) => {
        const embed = message.embeds[0];
        const claimedByField = {
          name: "Claimed by",
          value: `> <@!${interaction.user.id}> (${sanitizeInput(interaction.user.tag)})`,
        };
        embed.fields.push(claimedByField);

        const closeButton = new ButtonBuilder()
          .setCustomId("closeTicket")
          .setLabel(config.closeButton.label)
          .setEmoji(config.closeButton.emoji)
          .setStyle(ButtonStyle[config.closeButton.style]);

        const claimButton = new ButtonBuilder()
          .setCustomId("ticketclaim")
          .setLabel(config.claimButton.label)
          .setEmoji(config.claimButton.emoji)
          .setStyle(ButtonStyle[config.claimButton.style])
          .setDisabled(true);

        const unClaimButton = new ButtonBuilder()
          .setCustomId("ticketunclaim")
          .setLabel(config.unclaimButton.label)
          .setEmoji(config.unclaimButton.emoji)
          .setStyle(ButtonStyle[config.unclaimButton.style]);

        let actionRow2 = new ActionRowBuilder().addComponents(
          closeButton,
          claimButton,
          unClaimButton,
        );
        message.edit({ embeds: [embed], components: [actionRow2] });

        if (config.claim1on1) {
          let ticketButton = await ticketsDB.get(
            `${interaction.channel.id}.button`,
          );

          Object.keys(ticketCategories).forEach(async (id) => {
            if (ticketButton === id) {
              ticketCategories[id].support_role_ids.forEach(async (roleId) => {
                await interaction.channel.permissionOverwrites
                  .edit(roleId, {
                    SendMessages: false,
                    ViewChannel: true,
                  })
                  .catch((error) => {
                    console.error(`Error updating permissions:`, error);
                  });
              });
            }
          });
        }

        await interaction.channel.permissionOverwrites.edit(interaction.user, {
          SendMessages: true,
          ViewChannel: true,
          AttachFiles: true,
          EmbedLinks: true,
          ReadMessageHistory: true,
        });

        await ticketsDB.set(`${interaction.channel.id}.claimed`, true);
        await ticketsDB.set(
          `${interaction.channel.id}.claimUser`,
          interaction.user.id,
        );

        let logChannelId = config.logs.ticketClaim || config.logs.default;
        let logsChannel = interaction.guild.channels.cache.get(logChannelId);

        const logDefaultValues = {
          color: "#2FF200",
          title: "Ticket Logs | Ticket Claimed",
          timestamp: true,
          thumbnail: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
          footer: {
            text: `${interaction.user.tag}`,
            iconURL: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
          },
        };

        const logClaimedEmbed = await configEmbed(
          "logClaimedEmbed",
          logDefaultValues,
        );

        logClaimedEmbed.addFields([
          {
            name: config.logClaimedEmbed.field_staff,
            value: `> <@!${interaction.user.id}>\n> ${sanitizeInput(interaction.user.tag)}`,
          },
          {
            name: config.logClaimedEmbed.field_ticket,
            value: `> <#${interaction.channel.id}>\n> #${sanitizeInput(interaction.channel.name)}\n> ${await ticketsDB.get(`${interaction.channel.id}.ticketType`)}`,
          },
        ]);

        await logsChannel.send({ embeds: [logClaimedEmbed] });
        await mainDB.set("totalClaims", totalClaims + 1);
        logMessage(
          `${interaction.user.tag} claimed the ticket #${interaction.channel.name}`,
        );
      });
  },
};
