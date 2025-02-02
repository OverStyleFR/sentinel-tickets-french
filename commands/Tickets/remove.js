const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const fs = require("fs");
const yaml = require("yaml");
const configFile = fs.readFileSync("./config.yml", "utf8");
const config = yaml.parse(configFile);
const {
  ticketsDB,
  sanitizeInput,
  logMessage,
  checkSupportRole,
  configEmbed,
} = require("../../index.js");

module.exports = {
  enabled: config.commands.remove.enabled,
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a user or role from a ticket channel.")
    .addUserOption((option) =>
      option.setName("user").setDescription("Select a user").setRequired(false),
    )
    .addRoleOption((option) =>
      option.setName("role").setDescription("Select a role").setRequired(false),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits[config.commands.remove.permission],
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

    let user = interaction.options.getUser("user");
    let role = interaction.options.getRole("role");
    let logChannelId = config.logs.userRemove || config.logs.default;
    let logChannel = interaction.guild.channels.cache.get(logChannelId);

    if ((!user && !role) || (user && role)) {
      return interaction.reply({
        content: "Please provide either a user or a role, but not both.",
        ephemeral: true,
      });
    }

    if (user) {
      // Check if the user is in the ticket channel
      if (!interaction.channel.members.has(user.id)) {
        return interaction.reply({
          content: "That user is not in this ticket.",
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      interaction.channel.permissionOverwrites.delete(user);

      const logDefaultValues = {
        color: "#FF0000",
        title: "Ticket Logs | Target Removed",
        timestamp: true,
        thumbnail: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
        footer: {
          text: `${interaction.user.tag}`,
          iconURL: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
        },
      };

      const logUserRemoveEmbed = await configEmbed(
        "logRemoveEmbed",
        logDefaultValues,
      );

      logUserRemoveEmbed.addFields([
        {
          name: config.logRemoveEmbed.field_staff,
          value: `> ${interaction.user}\n> ${sanitizeInput(interaction.user.tag)}`,
        },
        {
          name: config.logRemoveEmbed.field_target,
          value: `> ${user}\n> ${sanitizeInput(user.tag)}`,
        },
        {
          name: config.logRemoveEmbed.field_ticket,
          value: `> ${interaction.channel}\n> #${sanitizeInput(interaction.channel.name)}`,
        },
      ]);

      const defaultValues = {
        color: "#FF0000",
        description: "Removed **{target} ({target.tag})** from the ticket.",
      };

      const userRemoveEmbed = await configEmbed("removeEmbed", defaultValues);

      if (userRemoveEmbed.data && userRemoveEmbed.data.description) {
        userRemoveEmbed.setDescription(
          userRemoveEmbed.data.description
            .replace(/\{target\}/g, user)
            .replace(/\{target\.tag\}/g, sanitizeInput(user.tag)),
        );
      }

      await interaction.editReply({ embeds: [userRemoveEmbed] });
      await logChannel.send({ embeds: [logUserRemoveEmbed] });
      logMessage(
        `${interaction.user.tag} removed ${user.tag} from the ticket #${interaction.channel.name}`,
      );
    }

    if (role) {
      // Check if the role is in the ticket channel
      if (!interaction.channel.permissionsFor(role.id).has("ViewChannel")) {
        return interaction.reply({
          content: "That role is not in this ticket.",
          ephemeral: true,
        });
      }

      await interaction.deferReply();
      interaction.channel.permissionOverwrites.delete(role);

      const logDefaultValues = {
        color: "#FF0000",
        title: "Ticket Logs | Target Removed",
        timestamp: true,
        thumbnail: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
        footer: {
          text: `${interaction.user.tag}`,
          iconURL: `${interaction.user.displayAvatarURL({ format: "png", dynamic: true, size: 1024 })}`,
        },
      };

      const logRoleRemoveEmbed = await configEmbed(
        "logRemoveEmbed",
        logDefaultValues,
      );

      logRoleRemoveEmbed.addFields([
        {
          name: config.logRemoveEmbed.field_staff,
          value: `> ${interaction.user}\n> ${sanitizeInput(interaction.user.tag)}`,
        },
        {
          name: config.logRemoveEmbed.field_target,
          value: `> ${role}\n> ${sanitizeInput(role.name)}`,
        },
        {
          name: config.logRemoveEmbed.field_ticket,
          value: `> ${interaction.channel}\n> #${sanitizeInput(interaction.channel.name)}`,
        },
      ]);

      const defaultValues = {
        color: "#FF0000",
        description: "Removed **{target} ({target.tag})** from the ticket.",
      };

      const roleRemoveEmbed = await configEmbed("removeEmbed", defaultValues);

      if (roleRemoveEmbed.data && roleRemoveEmbed.data.description) {
        roleRemoveEmbed.setDescription(
          roleRemoveEmbed.data.description
            .replace(/\{target\}/g, role)
            .replace(/\{target\.tag\}/g, sanitizeInput(role.name)),
        );
      }

      await interaction.editReply({ embeds: [roleRemoveEmbed] });
      await logChannel.send({ embeds: [logRoleRemoveEmbed] });
      logMessage(
        `${interaction.user.tag} removed ${role.name} from the ticket #${interaction.channel.name}`,
      );
    }
  },
};
