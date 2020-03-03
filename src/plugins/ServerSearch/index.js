module.exports = (Plugin, Api) => {
    const {DiscordSelectors, PluginUtilities, ColorConverter, WebpackModules, DiscordModules, ReactTools, Utilities, Structs: {Screen}} = Api;

    const SortedGuildStore = DiscordModules.SortedGuildStore;
    const ImageResolver = DiscordModules.ImageResolver;
    const GuildActions = DiscordModules.GuildActions;
    const GuildInfo = DiscordModules.GuildInfo;
    const Animations = WebpackModules.getByProps("spring");

    return class ServerSearch extends Plugin {
        constructor() {
            super();
            this.cancels = [];
    
            this.css = require("styles.css");
            this.guildHtml = require("guild.html");
            this.separatorHtml = require("separator.html");
            this.smallPopoutHtml = require("popout_small.html");
            this.largePopoutHtml = require("popout_large.html");
            this.popoutItemHtml = require("popout_item.html");
        }

        onStart() {
            PluginUtilities.addStyle(this.getName(), this.css);
            this.addSearchButton();
        }
        
        onStop() {
            $(".server-search-separator").remove();
            $("#server-search").remove();
            for (const c of this.cancels) c();
            PluginUtilities.removeStyle(this.getName());
        }

        getSettingsPanel() {
            return this.buildSettingsPanel().getElement();
        }

        addSearchButton() {
            const guildElement = $(this.guildHtml);
            const guildElementInner = guildElement.find(".wrapper-25eVIn");
            $(".listItem-2P_4kh .guildSeparator-3s64Iy").parent().before($(this.separatorHtml), guildElement);
    
            
            const gray = "#2F3136";
            const purple = "#7289da";
            const purpleRGB = ColorConverter.getRGB(purple);
            const grayRGB = ColorConverter.getRGB(gray);
            const backgroundColor = new Animations.Value(0);
            backgroundColor.interpolate({
                inputRange: [0, 1],
                outputRange: [purple, gray]
            });
    
            backgroundColor.addListener((value) => {
                const getVal = (i) => {
                    return Math.round((purpleRGB[i] - grayRGB[i]) * value.value + grayRGB[i]);
                };
                guildElementInner.css("background-color", `rgb(${getVal(0)}, ${getVal(1)}, ${getVal(2)})`);
            });
    
            const borderRadius = new Animations.Value(0);
            borderRadius.interpolate({
                inputRange: [0, 1],
                outputRange: [15, 25]
            });
    
            borderRadius.addListener((value) => {
                // (end - start) * value + start
                guildElementInner.css("border-radius", (15 - 25) * value.value + 25);
            });
    
            const animate = (v) => {
                Animations.parallel([
                    Animations.timing(backgroundColor, {toValue: v, duration: 200}),
                    Animations.spring(borderRadius, {toValue: v, friction: 3})
                ]).start();
            };
    
            guildElement.on("mouseenter", () => {animate(1);});
    
            guildElement.on("mouseleave", () => {
                if (!guildElement.hasClass("selected")) animate(0);
            });
    
            // new Tooltip(guildElement, "Server Search", {side: "right"});
    
            guildElement.on("click", (e) => {
                if (guildElement.hasClass("selected")) return;
                e.stopPropagation();
                guildElement.addClass("selected");
    
                if (this.settings.inPlace) {
                    return this.showSmallPopout(guildElement[0], {onClose: () => {
                        guildElement.removeClass("selected");
                        this.updateSearch("");
                        animate(0);
                    }});
                }
    
                this.showLargePopout(guildElement[0], {onClose: () => {
                    guildElement.removeClass("selected");
                    animate(0);
                }});
            });
        }
    
        showPopout(popout, target, id, options = {}) {
            const {onClose} = options;
            popout.appendTo(document.querySelector(DiscordSelectors.Popouts.popouts));
            const maxWidth = Screen.width;
            const maxHeight = Screen.height;
    
            const offset = target.getBoundingClientRect();
            if (offset.right + popout.outerHeight() >= maxWidth) {
                popout.addClass("popout-left");
                popout.css("left", Math.round(offset.left - popout.outerWidth() - 20));
                popout.animate({left: Math.round(offset.left - popout.outerWidth() - 10)}, 100);
            }
            else {
                popout.addClass("popout-right");
                popout.css("left", offset.right + 10);
                popout.animate({left: offset.right}, 100);
            }
    
            if (offset.top + popout.outerHeight() >= maxHeight) popout.css("top", Math.round(maxHeight - popout.outerHeight()));
            else popout.css("top", offset.top);
    
            const listener = document.addEventListener("click", (e) => {
                const target = $(e.target);
                if (!target.hasClass(id) && !target.parents(`.${id}`).length) {
                    popout.remove();
                    document.removeEventListener("click", listener);
                    if (onClose) onClose();
                }
            });
        }
    
        showSmallPopout(target, options = {}) {
            const {onClose} = options;
            const popout = $(this.smallPopoutHtml);
            const searchInput = popout.find("input");
            searchInput.on("keyup", () => {
                this.updateSearch(searchInput.val());
            });
    
            this.showPopout(popout, target, "popout-server-search-small", {onClose: onClose});
            searchInput.focus();
        }
    
        showLargePopout(target, options = {}) {
            const {onClose} = options;
    
            const guilds = SortedGuildStore.getSortedGuilds().slice(0);
            for (let i = 0; i < guilds.length; i++) guilds[i] = guilds[i].guild;
    
            const popout = $(Utilities.formatString(this.largePopoutHtml, {count: guilds.length}));
    
            const searchInput = popout.find("input");
            searchInput.on("keyup", () => {
                const items = popout[0].querySelectorAll(".search-result");
                for (let i = 0, len = items.length; i < len; i++) {
                    const search = searchInput.val().toLowerCase();
                    const item = items[i];
                    const username = item.querySelector(".username").textContent.toLowerCase();
                    if (!username.includes(search)) item.style.display = "none";
                    else item.style.display = "";
                }
            });
    
            const scroller = popout.find(".search-results");
            for (const guild of guilds) {
                const image = ImageResolver.getGuildIconURL(guild);
                const elem = $(Utilities.formatString(this.popoutItemHtml, {name: guild.name, image_url: image}));
                if (!image) {
                    const imageElement = elem.find(".image-33JSyf");
                    imageElement.text(GuildInfo.getAcronym(guild.name));
                    imageElement.addClass("no-image");
                }
                elem.on("click", () => {
                    GuildActions.selectGuild(guild.id);
                });
                scroller.append(elem);
            }
    
            this.showPopout(popout, target, "popout-server-search", {onClose: onClose});
            searchInput.focus();
        }
    
        updateSearch(query) {
            if (!query) return this.resetGuilds();
            $(".listItem-2P_4kh:has(.blobContainer-239gwq)").each((_, guild) => {
                const name = ReactTools.getReactProperty(guild, "return.memoizedProps.guild.name");
                if (name.toLowerCase().includes(query.toLowerCase())) guild.style.display = "";
                else guild.style.display = "none";
            });
        }
    
        resetGuilds() {
            $(".listItem-2P_4kh:has(.blobContainer-239gwq)").each((_, guild) => {
                guild.style.display = "";
            });
        }

    };
};