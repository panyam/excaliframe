
NUM_LINKED_GOMODS=`cat go.mod | grep -v "^\/\/" | grep replace | wc -l | sed -e "s/ *//g"`

all: run

run: resymlink
	EXCALIFRAME_ENV=dev go run .

build: resymlink
	go build -o bin/excaliframe-site .

resymlink:
	mkdir -p locallinks
	rm -Rf locallinks/*
	cd locallinks && ln -s ~/newstack

checklinks:
	@if [ x"${NUM_LINKED_GOMODS}" != "x0" ]; then	\
		echo "You are trying to deploy with symlinks. Remove them first and make sure versions exist" && false ;	\
	fi

deploy: checklinks
	rm -Rf locallinks ; mkdir locallinks
	gcloud app deploy --project excaliframe --verbosity=info

prodlogs:
	gcloud app logs tail -s default --project excaliframe

clean:
	rm -Rf bin locallinks

.PHONY: all run build resymlink checklinks deploy prodlogs clean
