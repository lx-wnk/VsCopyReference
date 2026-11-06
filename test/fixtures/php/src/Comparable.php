<?php

namespace App;

interface Comparable
{
    public function compare();
}

class First implements Comparable
{
    public function compare()
    {
    }
}

class Second implements Comparable
{
    public function compare()
    {
    }
}
