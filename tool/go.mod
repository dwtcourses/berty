// this file is just a precaution to avoid golang to process this directory

module berty.tech/berty/tool/v2

go 1.14

require (
	berty.tech/berty/v2 v2.0.0
	github.com/Masterminds/semver v1.5.0
	github.com/fatih/color v1.9.0
	gopkg.in/yaml.v3 v3.0.0-20200615113413-eeeca48fe776
	moul.io/u v1.18.0
)

replace berty.tech/berty/v2 => ../
