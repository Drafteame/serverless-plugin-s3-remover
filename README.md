# serverless-plugin-s3-remover

A Simple serverless plugin that helps to empty the deployment bucket before removing the stack.

## Requirements

#### AWS Policies

The following AWS permissions are required for this plugin to work:

- `s3:ListAllMyBuckets`
- `s3:ListBucket`
- `s3:DeleteObject`
- `s3:DeleteBucket`

## Installation

Install the plugin via npm:

```bash
npm install --save-dev serverless-plugin-s3-remover
```

Add the plugin to your `serverless.yml` file:

```yaml
plugins:
  - serverless-plugin-s3-remover
```

## Execution

The plugin will run automatically when you run `serverless remove` command.
