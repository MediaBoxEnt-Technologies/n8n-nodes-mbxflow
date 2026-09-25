# n8n-nodes-mbxflow

Connect [MBX Flow](https://mbxflow.com) to [n8n](https://n8n.io), the workflow automation tool.

With these nodes, n8n can:

- **Save a post as a draft** in MBX Flow, so you can review and finish it there.
- **Schedule a post** to your connected social accounts for a date and time (at least 10 minutes ahead, at most one year).
- **List your connected accounts** and **your posts**, or look up one post.
- **Start a workflow when a post is published, or when a post fails.**

For safety, nothing sent from n8n is published right away, and nothing can be deleted. Full API reference: [mbxflow.com/developers/api](https://mbxflow.com/developers/api).

## What you need

- An MBX Flow account on the **Pro plan or higher**. Connected apps are included from Pro.
- n8n, version 1.0 or newer, where you are allowed to install community nodes.

## Step 1: Install the MBX Flow nodes in n8n

1. In n8n, open **Settings** (bottom left), then **Community Nodes**.
2. Click **Install**.
3. Type `n8n-nodes-mbxflow` in the npm package name box.
4. Tick the box that says you understand the risks of community nodes, then click **Install**.

After a few seconds, **MBX Flow** and **MBX Flow Trigger** show up when you add a node to a workflow (search for "MBX Flow").

## Step 2: Get your key in MBX Flow

1. Sign in to MBX Flow.
2. Go to **Settings**, then **Integrations**, then **Connected apps**.
3. Create a new key and name it something like "n8n".
4. Copy the key. It starts with `mbx_`. It is shown only once, so paste it somewhere safe until Step 3 is done.

If you ever stop using n8n, delete that key in the same place. Only n8n loses access; your other apps keep working.

## Step 3: Add the key to n8n

1. In any workflow, add an **MBX Flow** node.
2. Under **Credential to connect with**, choose **Create new credential**.
3. Paste your key into **API Key** and click **Save**.

n8n checks the key right away. A green "Connection tested successfully" message means you are ready.

## What each node does

### MBX Flow

| Resource | Operation | What it does |
| --- | --- | --- |
| Account | Get Many | Lists the connected social accounts a post can go to. |
| Post | Create Draft | Saves a draft. Text is required; accounts and media links are optional. |
| Post | Schedule | Schedules a post. Needs text, at least one account, and a date and time. |
| Post | Get | Gets one post by its ID, for example to check whether it was published. |
| Post | Get Many | Lists your posts, newest first. You can filter by status (draft, scheduled, published, failed) and choose how many to get, up to 100. |

Good to know:

- **Text** can be up to 5000 characters.
- **Media URLs** are links to images or videos, one per line or separated by commas. Each must start with `https://`, up to 10 per post.
- **Accounts** is a list you pick from. It is filled from your MBX Flow account, shown as "Name (Network)".
- If MBX Flow refuses something, the n8n error shows MBX Flow's own explanation, for example "scheduledAt must be at least 10 minutes from now."

### MBX Flow Trigger

Choose an **Event**:

- **Post Published**: runs once for every post that gets published.
- **Post Failed**: runs once for every post that could not be published.

The trigger checks MBX Flow on a schedule (every minute by default; you can change it in the node). The first check after you activate the workflow only takes note of the posts already there, so old posts never set it off. When you click **Test step** (or **Fetch test event**), it shows your latest matching post as a sample, so you can map its fields in the next nodes.

Each post the nodes return looks like this:

```json
{
  "id": "cm1abc...",
  "status": "published",
  "text": "New mix out now",
  "mediaUrls": ["https://example.com/cover.jpg"],
  "scheduledAt": null,
  "publishedAt": "2026-10-01T18:30:04.000Z",
  "createdAt": "2026-09-30T12:00:00.000Z",
  "accounts": [{ "id": "acc_1", "network": "bluesky", "name": "DJ Time" }]
}
```

## Example workflows

### 1. Every new blog or podcast item becomes a draft

Turn each new item from an RSS feed into a draft you can polish in MBX Flow.

1. Add an **RSS Feed Trigger** node. Paste your feed address (for example `https://yourblog.com/feed`).
2. Add an **MBX Flow** node after it:
   - Resource: **Post**
   - Operation: **Create Draft**
   - Text: drag in the item title and link, for example `New on the blog: {{ $json.title }} {{ $json.link }}`
   - Optional: under **Additional Fields**, add **Account Names or IDs** to say which accounts the draft is for.
3. Activate the workflow. New feed items now appear as drafts in MBX Flow.

### 2. A Google Sheets row becomes a scheduled post

Plan posts in a spreadsheet and let n8n schedule them.

1. Make a sheet with the columns **Text**, **Date** (like `2026-10-01 18:30`), and optionally **Image** (an `https://` link).
2. Add a **Google Sheets Trigger** node set to fire on **Row Added**, pointing at that sheet.
3. Add an **MBX Flow** node:
   - Resource: **Post**
   - Operation: **Schedule**
   - Text: `{{ $json.Text }}`
   - Account Names or IDs: pick the accounts from the list.
   - Scheduled At: `{{ $json.Date }}`
   - Optional: under **Additional Fields**, set **Media URLs** to `{{ $json.Image }}`.
4. Activate the workflow. Each new row is scheduled in MBX Flow and appears in your queue, where you can still change or cancel it.

Tip: dates without a time zone are read in the time zone n8n uses. To be exact, write the date with its offset, for example `2026-10-01T18:30:00-04:00`.

### 3. Get an alert when a post fails

Hear about a failed post right away, in Slack or by email.

1. Add an **MBX Flow Trigger** node with Event **Post Failed**.
2. Add a **Slack** node (Send a message) or a **Send Email** node.
3. Write the message, for example: `A post failed in MBX Flow: "{{ $json.text }}" on {{ $json.accounts.map(a => a.name).join(', ') }}. Open MBX Flow to see why and retry.`
4. Activate the workflow.

## Troubleshooting

- **"This key is not valid"**: the key was typed wrong or deleted. Create a new one in MBX Flow (Settings, Integrations, Connected apps) and update the credential in n8n.
- **A message about the Pro plan**: connected apps are included from the Pro plan. Upgrade in MBX Flow under Settings.
- **The Accounts list is empty**: connect your social accounts in MBX Flow first, then reopen the list in n8n.
- **"scheduledAt must be at least 10 minutes from now"**: pick a later time. Posts from n8n always wait at least 10 minutes so someone can review them.

## Support

- API reference: [mbxflow.com/developers/api](https://mbxflow.com/developers/api)
- Email: hello@mediaboxent.tech

## License

[MIT](LICENSE). MBX Flow is a product of MediaBoxEnt Technologies.

## Limits

MBX Flow counts requests per workspace, shared by every app and key: Pro allows 150 requests every 15 minutes, 2,000 a day and 100 new posts a day; Studio 300, 5,000 and 250; Manager 600, 10,000 and 500. Past a limit the answer is 429 with a Retry-After header. Details: https://mbxflow.com/developers/api
