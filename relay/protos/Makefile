
buf: ensureenv clean
	buf dep update
	buf generate
	goimports -w `find ../gen | grep "\.go"`

clean:
	rm -Rf ../gen
	rm -f buf.lock

cleanall: clean
	rm -f buf.yaml
	rm -f buf.gen.yaml

setupdev: cleanall
	ln -s buf.gen.yaml.dev buf.gen.yaml
	ln -s buf.yaml.dev buf.yaml

setupprod: cleanall
	ln -s buf.gen.yaml.prod buf.gen.yaml
	ln -s buf.yaml.prod buf.yaml

ensureenv:
	@test -f buf.yaml && test -f buf.gen.yaml || echo "buf.yaml does not exist.  Run 'make setupdev' or 'make setupprod' to setup your environment..."
