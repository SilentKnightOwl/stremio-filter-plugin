PLUGIN := stream-filter.plugin.js
DEST   := $(HOME)/.config/stremio-enhanced/plugins

.PHONY: install uninstall test

# Symlink so edits and `git pull` apply after Ctrl+R in Stremio Enhanced.
install:
	mkdir -p $(DEST)
	ln -sfn $(CURDIR)/$(PLUGIN) $(DEST)/$(PLUGIN)
	@echo "Linked $(DEST)/$(PLUGIN)"

uninstall:
	rm -f $(DEST)/$(PLUGIN)

test:
	npm test
