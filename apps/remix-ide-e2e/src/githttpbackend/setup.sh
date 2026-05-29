#!/bin/bash
set -e  # Exit on error

echo "Setting up git repositories..."

cd /tmp/
rm -rf git/bare.git
rm -rf git/bare2.git
rm -rf git
mkdir -p git
cd git

git config --global user.name "ci-bot"
git config --global user.email "ci-bot@remix-project.org"

echo "Cloning bare.git..."
if git clone --bare https://github.com/remix-project-org/awesome-remix bare.git; then
    echo "Successfully cloned bare.git"
else
    echo "Failed to clone bare.git"
    exit 1
fi

echo "Cloning bare2.git..."
if git clone --bare https://github.com/remix-project-org/awesome-remix bare2.git; then
    echo "Successfully cloned bare2.git"
else
    echo "Failed to clone bare2.git"
    exit 1
fi

echo "Git repositories setup complete!"
echo "Repositories location:"
ls -la /tmp/git/
